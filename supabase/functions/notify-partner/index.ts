import nodemailer from "npm:nodemailer@6.9.10";

// 双方邮箱与称呼映射表
const STORY_MEMBERS: Record<string, { partnerEmail: string; partnerName: string; selfName: string }> = {
  "大大布": {
    partnerEmail: "1014779580@qq.com",
    partnerName: "小小二",
    selfName: "大大布",
  },
  "小小二": {
    partnerEmail: "484784621@qq.com",
    partnerName: "大大布",
    selfName: "小小二",
  },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationData {
  actor: string;
  partnerEmail: string;
  partnerName: string;
  type: "letter" | "memory" | "perspective" | "test";
  title: string;
  snippet?: string;
  date?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const smtpUser = Deno.env.get("SMTP_USER") || "484784621@qq.com";
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.qq.com";
    const smtpPort = Number(Deno.env.get("SMTP_PORT") || "465");
    const websiteUrl = Deno.env.get("WEBSITE_URL") || "https://edisonhuang22.github.io/our-story-2025/";

    if (!smtpPass) {
      console.error("Missing SMTP_PASS environment variable");
      return new Response(
        JSON.stringify({ error: "SMTP_PASS 未配置，请在 Supabase Secrets 中设置 QQ 邮箱授权码。" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json().catch(() => ({}));
    console.log("Received notification request:", JSON.stringify(payload));

    let notifyData: NotificationData | null = null;

    // 1. 处理来自 Supabase Database Webhook 的触发
    if (payload.record && payload.table) {
      const { table, type, record, old_record } = payload;

      // 信件创建
      if (table === "story_letters") {
        if (type !== "INSERT" || record.is_original) {
          return new Response(JSON.stringify({ message: "Ignored non-new or initial letter" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const member = STORY_MEMBERS[record.sender];
        if (!member) {
          return new Response(JSON.stringify({ message: "Unknown sender: " + record.sender }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        notifyData = {
          actor: member.selfName,
          partnerEmail: member.partnerEmail,
          partnerName: member.partnerName,
          type: "letter",
          title: record.title || "未命名信件",
          snippet: record.body ? record.body.slice(0, 150) : "",
          date: record.date,
        };
      }
      // 回忆创建
      else if (table === "story_gallery_entries") {
        if (type !== "INSERT" || record.hidden) {
          return new Response(JSON.stringify({ message: "Ignored hidden or non-insert gallery entry" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const member = STORY_MEMBERS[record.author];
        if (!member) {
          return new Response(JSON.stringify({ message: "Unknown author: " + record.author }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        notifyData = {
          actor: member.selfName,
          partnerEmail: member.partnerEmail,
          partnerName: member.partnerName,
          type: "memory",
          title: record.title || "新回忆",
          snippet: record.body ? record.body.slice(0, 150) : "",
          date: record.memory_date || record.folder,
        };
      }
      // 心声/视角添加
      else if (table === "memory_perspectives") {
        if (!record.body || !record.body.trim()) {
          return new Response(JSON.stringify({ message: "Perspective body is empty" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (type === "UPDATE" && old_record && old_record.body === record.body) {
          return new Response(JSON.stringify({ message: "Perspective body unchanged" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const member = STORY_MEMBERS[record.author];
        if (!member) {
          return new Response(JSON.stringify({ message: "Unknown author: " + record.author }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        notifyData = {
          actor: member.selfName,
          partnerEmail: member.partnerEmail,
          partnerName: member.partnerName,
          type: "perspective",
          title: `${record.folder} 的回忆心声`,
          snippet: record.body.slice(0, 150),
          date: record.folder,
        };
      }
    }
    // 2. 支持直接手动调用测试或前端调用
    else if (payload.action) {
      const member = STORY_MEMBERS[payload.author];
      if (member) {
        notifyData = {
          actor: member.selfName,
          partnerEmail: member.partnerEmail,
          partnerName: member.partnerName,
          type: payload.action,
          title: payload.title || "测试消息",
          snippet: payload.snippet || payload.body || "",
          date: payload.date || new Date().toISOString().slice(0, 10),
        };
      }
    }

    if (!notifyData) {
      return new Response(JSON.stringify({ message: "No notification required for this event." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 组装邮件内容
    let subject = "";
    let headerTitle = "";
    let typeBadge = "";
    let actionTip = "";

    if (notifyData.type === "letter") {
      subject = `💌【小窝信箱】${notifyData.actor} 给你写了一封新信件：《${notifyData.title}》`;
      headerTitle = `${notifyData.actor} 悄悄给你寄来了一封信`;
      typeBadge = "新 信 件";
      actionTip = "快去信箱拆开看看吧~";
    } else if (notifyData.type === "memory") {
      subject = `✨【新的回忆】${notifyData.actor} 添加了一段新记忆：《${notifyData.title}》`;
      headerTitle = `${notifyData.actor} 在小窝记录了一段新回忆`;
      typeBadge = "新 回 忆";
      actionTip = "点击直达网站重温属于你们的美好瞬间~";
    } else if (notifyData.type === "perspective") {
      subject = `💭【回忆心声】${notifyData.actor} 写下了新的独家心声`;
      headerTitle = `${notifyData.actor} 在回忆中写下了专属心声`;
      typeBadge = "心 声 更 新";
      actionTip = "去看看对方此时此刻的心情与思绪吧~";
    } else {
      subject = `🔔【小窝通知】来自 ${notifyData.actor} 的测试提醒`;
      headerTitle = "小窝邮件通知测试成功！";
      typeBadge = "连 通 测 试";
      actionTip = "邮件通知配置一切正常~";
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 24px 12px; background-color: #faf7f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #3d3532;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; box-shadow: 0 10px 25px rgba(220, 180, 170, 0.18); overflow: hidden; border: 1px solid #f2e9e4;">
        <!-- 顶部装饰色块 -->
        <div style="background: linear-gradient(135deg, #f8b4be, #fcd5ce); padding: 28px 24px; text-align: center;">
          <div style="display: inline-block; background: rgba(255, 255, 255, 0.9); color: #d96b7d; padding: 4px 14px; border-radius: 12px; font-size: 12px; font-weight: bold; letter-spacing: 1px; margin-bottom: 12px;">
            ${typeBadge}
          </div>
          <h1 style="margin: 0; font-size: 20px; color: #4a383b; font-weight: 700; line-height: 1.4;">
            ${headerTitle}
          </h1>
        </div>

        <!-- 核心内容区域 -->
        <div style="padding: 26px 24px;">
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0; color: #5a4f4d;">
            亲爱的 <strong>${notifyData.partnerName}</strong>：
          </p>
          <div style="background: #fdf9f7; border-left: 4px solid #f8b4be; padding: 16px 18px; border-radius: 8px; margin-bottom: 22px;">
            <div style="font-size: 16px; font-weight: bold; color: #2d2325; margin-bottom: 6px;">
              ${notifyData.title}
            </div>
            ${notifyData.date ? `<div style="font-size: 13px; color: #9c8e8c; margin-bottom: 8px;">时间：${notifyData.date}</div>` : ""}
            ${
              notifyData.snippet
                ? `<div style="font-size: 14px; color: #6e605d; line-height: 1.6; white-space: pre-wrap;">${notifyData.snippet}${notifyData.snippet.length >= 150 ? "..." : ""}</div>`
                : ""
            }
          </div>

          <p style="font-size: 14px; color: #8a7c79; line-height: 1.5; margin: 0 0 24px 0;">
            ${actionTip}
          </p>

          <!-- 访问按钮 -->
          <div style="text-align: center; margin-bottom: 12px;">
            <a href="${websiteUrl}" target="_blank" style="display: inline-block; background: #e07a5f; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 25px; font-size: 15px; font-weight: bold; box-shadow: 0 4px 12px rgba(224, 122, 95, 0.35);">
              打开我们的小窝 ✨
            </a>
          </div>
        </div>

        <!-- 底部落款 -->
        <div style="background: #faf4f0; padding: 14px 20px; text-align: center; font-size: 12px; color: #b0a4a2; border-top: 1px solid #f2e9e4;">
          大大布将军与小小二下士 · 专属秘密花园
        </div>
      </div>
    </body>
    </html>
    `;

    // 创建 SMTP 邮件发送客户端
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    console.log(`Sending email to ${notifyData.partnerEmail} (from ${smtpUser})...`);

    const info = await transporter.sendMail({
      from: `"小窝信使 (${notifyData.actor})" <${smtpUser}>`,
      to: notifyData.partnerEmail,
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", info.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "通知邮件已成功发送",
        messageId: info.messageId,
        to: notifyData.partnerEmail,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error sending notification:", err);
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
