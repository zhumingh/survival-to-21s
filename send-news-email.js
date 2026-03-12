const nodemailer = require('nodemailer');

const GMAIL_USER = 'zhumingh@gmail.com';
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;

if (!GMAIL_PASS) {
  console.error('Error: Set GMAIL_APP_PASSWORD env variable first.');
  console.error('  export GMAIL_APP_PASSWORD="your-16-char-app-password"');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS }
});

const htmlBody = `
<div style="font-family: -apple-system, Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #222;">
  <div style="background: linear-gradient(135deg, #06060f, #0a1a0f); padding: 28px 24px; border-radius: 12px 12px 0 0;">
    <h1 style="color: #00e664; font-size: 22px; margin: 0; letter-spacing: 1px;">2026年3月 AI技术热点 Top 5</h1>
    <p style="color: rgba(255,255,255,0.5); font-size: 13px; margin: 6px 0 0;">by Claude Code &middot; ${new Date().toLocaleDateString('zh-CN')}</p>
  </div>

  <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">

    <div style="margin-bottom: 22px;">
      <h2 style="font-size: 16px; color: #111; margin: 0 0 6px;">1. Anthropic 发布 Claude 4.6 系列模型</h2>
      <p style="font-size: 14px; color: #444; line-height: 1.7; margin: 0;">
        Anthropic 发布了 Claude Sonnet 4.6（2月17日）和 Opus 4.6（2月5日），重点提升了代码生成、推理能力和超长上下文处理。Sonnet 4.6 引入了 <strong>100万 token 上下文窗口</strong>（Beta测试中）。3月初，Anthropic 还为所有用户开放了<strong>记忆功能</strong>，使 Claude 能够跨对话保持上下文。
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">

    <div style="margin-bottom: 22px;">
      <h2 style="font-size: 16px; color: #111; margin: 0 0 6px;">2. NVIDIA GTC 大会与 Rubin 平台</h2>
      <p style="font-size: 14px; color: #444; line-height: 1.7; margin: 0;">
        NVIDIA 股价在 GTC 大会前上涨，投资者期待新一代 AI 芯片发布。<strong>Rubin 平台</strong>预计于2026年下半年推出，标志着 NVIDIA AI 加速器架构的下一阶段，将进一步巩固其在高性能计算领域的领先地位。
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">

    <div style="margin-bottom: 22px;">
      <h2 style="font-size: 16px; color: #111; margin: 0 0 6px;">3. 苹果全面重构 Siri —— AI 驱动的新版本</h2>
      <p style="font-size: 14px; color: #444; line-height: 1.7; margin: 0;">
        苹果计划在2026年3月随 <strong>iOS 26.4</strong> 发布全新的、完全由 AI 驱动的 Siri。这是 Siri 自诞生以来最大规模的一次重构，标志着苹果正式全面拥抱生成式 AI。
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">

    <div style="margin-bottom: 22px;">
      <h2 style="font-size: 16px; color: #111; margin: 0 0 6px;">4. AI 医疗突破：10秒心电图诊断心脏病</h2>
      <p style="font-size: 14px; color: #444; line-height: 1.7; margin: 0;">
        密歇根大学研究人员开发了一种 AI 模型，仅需一段标准的 <strong>10秒心电图（EKG）</strong> 即可诊断冠状动脉微血管功能障碍（CMVD）。这一突破大幅降低了心脏病早期筛查的门槛。
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">

    <div style="margin-bottom: 22px;">
      <h2 style="font-size: 16px; color: #111; margin: 0 0 6px;">5. 中国"十五五"规划：AI 全面融入经济</h2>
      <p style="font-size: 14px; color: #444; line-height: 1.7; margin: 0;">
        中国最新五年规划明确提出将 <strong>AI 全面融入国民经济</strong>，推动科技自主突破。规划涵盖 AI 基础设施建设、芯片研发、智能制造等多个核心领域，显示出国家层面对 AI 产业的战略决心。
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">

    <p style="font-size: 12px; color: #999; margin: 16px 0 0; line-height: 1.6;">
      Sources:
      <a href="https://www.crescendo.ai/news/latest-ai-news-and-updates" style="color: #666;">Crescendo AI</a> &middot;
      <a href="https://radicaldatascience.wordpress.com/2026/03/09/ai-news-briefs-bulletin-board-for-march-2026/" style="color: #666;">Radical Data Science</a> &middot;
      <a href="https://techstartups.com/2026/03/10/top-tech-news-today-march-10-2026/" style="color: #666;">Tech Startups</a> &middot;
      <a href="https://www.bworldonline.com/world/2026/03/05/734429/chinas-new-five-year-plan-calls-for-ai-throughout-its-economy-tech-breakthroughs/" style="color: #666;">BusinessWorld</a> &middot;
      <a href="https://www.devflokers.com/blog/ai-breakthroughs-march-2026" style="color: #666;">devFlokers</a>
    </p>
  </div>
</div>
`;

transporter.sendMail({
  from: `"Claude Code AI News" <${GMAIL_USER}>`,
  to: GMAIL_USER,
  subject: '2026年3月 AI技术热点 Top 5',
  html: htmlBody
}).then(info => {
  console.log('Email sent successfully!');
  console.log('Message ID:', info.messageId);
}).catch(err => {
  console.error('Failed to send:', err.message);
});
