import json
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(r"C:\Users\48478\Documents\Codex\2026-08-17\superpowers-plugin-superpowers-openai-curated-i")
PHOTOS_DIR = ROOT / "photos"
OUT_IMG = ROOT / "site" / "img"
OUT_JSON = ROOT / "site" / "data" / "photos.json"
HEIF_CONVERT = r"C:\Users\48478\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\libheif\libheif\bin\heif-convert.exe"
TMP_DIR = ROOT / "work" / "heic-tmp"
MAX_EDGE = 1400
QUALITY = 82
SUPPORTED = {".jpg", ".jpeg", ".png", ".heic"}


def natural_key(name: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def parse_date(folder: str):
    m = re.match(r"(\d{4})\.(\d{1,2})\.(\d{1,2})$", folder.strip())
    if not m:
        raise ValueError(f"无法解析日期目录名: {folder}")
    return tuple(int(x) for x in m.groups())


def main():
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    chapters = []
    folders = [p for p in PHOTOS_DIR.iterdir() if p.is_dir()]
    folders.sort(key=lambda p: parse_date(p.name))
    for folder in folders:
        files = [f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in SUPPORTED]
        if not files:
            print(f"[跳过空目录] {folder.name}")
            continue
        files.sort(key=lambda f: natural_key(f.name))
        slug = folder.name.replace(".", "-")
        out_dir = OUT_IMG / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        photos = []
        for idx, f in enumerate(files, start=1):
            src = f
            tmp = None
            if f.suffix.lower() == ".heic":
                tmp = TMP_DIR / (f.stem + ".jpg")
                subprocess.run([HEIF_CONVERT, str(f), str(tmp)], check=True, capture_output=True)
                src = tmp
            with Image.open(src) as im:
                im = ImageOps.exif_transpose(im)
                if im.mode in ("RGBA", "P", "LA"):
                    rgba = im.convert("RGBA")
                    bg = Image.new("RGB", rgba.size, (255, 255, 255))
                    bg.paste(rgba, mask=rgba.split()[-1])
                    im = bg
                else:
                    im = im.convert("RGB")
                im.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
                out_path = out_dir / f"{idx}.jpg"
                im.save(out_path, "JPEG", quality=QUALITY, progressive=True, optimize=True)
                w, h = im.size
                photos.append({"src": f"img/{slug}/{idx}.jpg", "w": w, "h": h})
        chapters.append({"folder": folder.name, "photos": photos})
        print(f"[完成] {folder.name}: {len(photos)} 张")
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({"chapters": chapters}, ensure_ascii=False, indent=2), encoding="utf-8")
    total = sum(len(c["photos"]) for c in chapters)
    print(f"[完成] 共 {total} 张，写入 {OUT_JSON}")


if __name__ == "__main__":
    main()
