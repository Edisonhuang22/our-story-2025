import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');

const SUPABASE_URL = 'https://ewqxttklaaqxybldaklc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_HzCozccJE_h16H9Mhepibw_yC1Q6TIY';

function promptPassword(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function fetchWithRetry(url, options = {}, retries = 5, backoffMs = 1500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status >= 500 || res.status === 429) {
        if (attempt === retries) return res;
        const delay = backoffMs * attempt;
        process.stdout.write(`\n    [网络响应 HTTP ${res.status}] ${Math.round(delay / 1000)}秒后自动重试 (${attempt}/${retries})... `);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt === retries) {
        throw new Error(`网络请求失败 (已尝试 ${retries} 次): ${err.message || err}`);
      }
      const delay = backoffMs * attempt;
      process.stdout.write(`\n    [网络抖动: ${err.message || err}] ${Math.round(delay / 1000)}秒后自动重试 (${attempt}/${retries})... `);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function login(email, password) {
  const res = await fetchWithRetry(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`登录失败 (${res.status}): ${errorBody}`);
  }
  return await res.json();
}

async function getExistingPhotos(token) {
  const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/story_gallery_photos?select=id,folder,storage_path`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) {
    throw new Error(`读取云端照片表失败 (${res.status}): ${await res.text()}`);
  }
  return await res.json();
}

async function deleteStorageFile(token, bucket, storagePath) {
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prefixes: [storagePath] })
    });
  } catch (_) {}
}

async function uploadFile(token, bucket, storagePath, fileBuffer, contentType = 'image/webp') {
  let res = await fetchWithRetry(`${SUPABASE_URL}/storage/v1/object/${bucket}/${storagePath}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': contentType,
      'x-upsert': 'true'
    },
    body: fileBuffer
  });
  if (!res.ok) {
    const errorText = await res.text();
    // 若因已存在文件触发 upsert UPDATE 但缺少 UPDATE 策略导致 RLS 400/403，先删除后重传
    if (res.status === 400 || res.status === 403 || errorText.includes('row-level security')) {
      await deleteStorageFile(token, bucket, storagePath);
      res = await fetchWithRetry(`${SUPABASE_URL}/storage/v1/object/${bucket}/${storagePath}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': contentType
        },
        body: fileBuffer
      });
      if (res.ok) return;
    }
    throw new Error(`上传文件失败 ${storagePath} (${res.status}): ${errorText}`);
  }
}

async function insertPhotoRow(token, photoData) {
  const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/story_gallery_photos`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(photoData)
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 409 || errorText.includes('duplicate key') || errorText.includes('23505')) {
      return [{ storage_path: photoData.storage_path }];
    }
    throw new Error(`插入照片数据失败 (${res.status}): ${errorText}`);
  }
  return await res.json();
}

async function main() {
  console.log('=====================================================');
  console.log('   88 张历史照片与回忆一键迁移至 Supabase 脚本');
  console.log('=====================================================\n');

  let email = '484784621@qq.com';
  let password = process.env.SUPABASE_PASSWORD || '';

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) email = args[++i];
    if (args[i] === '--password' && args[i + 1]) password = args[++i];
  }

  if (!password) {
    password = await promptPassword(`请输入 ${email} 的 Supabase 登录密码: `);
  }

  console.log(`\n正在登录 ${email}...`);
  const authData = await login(email, password);
  const user = authData.user;
  const token = authData.access_token;
  console.log(`[成功] 登录成功！用户 ID: ${user.id}\n`);

  console.log('正在读取本地照片与云端已存数据...');
  const photosJsonPath = path.join(SITE, 'data', 'photos.json');
  if (!fs.existsSync(photosJsonPath)) {
    throw new Error(`未找到 ${photosJsonPath} 文件`);
  }
  const photoData = JSON.parse(fs.readFileSync(photosJsonPath, 'utf-8'));
  const existingRows = await getExistingPhotos(token);
  const existingPaths = new Set(existingRows.map(r => r.storage_path).filter(Boolean));
  console.log(`云端已有 ${existingRows.length} 条照片记录。\n`);

  let totalPhotos = 0;
  photoData.chapters.forEach(ch => totalPhotos += ch.photos.length);
  console.log(`本地共有 ${photoData.chapters.length} 个回忆章节，合计 ${totalPhotos} 张照片待处理。\n`);

  let uploadedCount = 0;
  let skippedCount = 0;

  for (const chapter of photoData.chapters) {
    const folder = chapter.folder;
    console.log(`▶ 处理章节: ${folder} (${chapter.photos.length} 张照片)`);

    for (let idx = 0; idx < chapter.photos.length; idx++) {
      const p = chapter.photos[idx];
      const photoNum = idx + 1;
      const slug = folder.replace(/\./g, '-');
      const storagePath = `${user.id}/legacy/${slug}/${photoNum}.webp`;
      const thumbPath = `${user.id}/legacy/${slug}/${photoNum}_thumb.webp`;

      if (existingPaths.has(storagePath)) {
        skippedCount++;
        process.stdout.write(`  - [已存在] 第 ${photoNum} 张: ${storagePath}\n`);
        continue;
      }

      // 读取原始图与缩略图
      const localSrc = path.join(SITE, p.src);
      const localThumb = p.thumb ? path.join(SITE, p.thumb) : localSrc;

      if (!fs.existsSync(localSrc)) {
        console.warn(`  - [跳过] 未在本地找到文件: ${localSrc}`);
        continue;
      }

      const srcBuffer = fs.readFileSync(localSrc);
      const thumbBuffer = fs.existsSync(localThumb) ? fs.readFileSync(localThumb) : srcBuffer;

      process.stdout.write(`  - 正在上传第 ${photoNum} 张: 原图 (${Math.round(srcBuffer.length / 1024)}KB) + 缩略图 (${Math.round(thumbBuffer.length / 1024)}KB)... `);

      // 上传至 story-gallery 存储桶
      await uploadFile(token, 'story-gallery', storagePath, srcBuffer, 'image/webp');
      await uploadFile(token, 'story-gallery', thumbPath, thumbBuffer, 'image/webp');

      // 写入 story_gallery_photos 表
      await insertPhotoRow(token, {
        folder: folder,
        storage_path: storagePath,
        thumb_path: thumbPath,
        hidden: false
      });

      existingPaths.add(storagePath);
      uploadedCount++;
      process.stdout.write(`[完成]\n`);
    }
  }

  console.log('\n=====================================================');
  console.log(`   迁移执行完毕！`);
  console.log(`   - 成功新上传: ${uploadedCount} 张`);
  console.log(`   - 原先已存在: ${skippedCount} 张`);
  console.log(`   - 总计云端有效: ${existingPaths.size} 张`);
  console.log('=====================================================\n');
}

main().catch(err => {
  console.error('\n[错误]', err.message || err);
  process.exit(1);
});
