import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(req: NextRequest) {
  const { recipientName, recipientEmail, document, category, dueDate, note, isReminder, signingUrl } =
    await req.json();

  if (!recipientEmail || !document) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const subject = isReminder
    ? `Reminder: Signature required – ${document}`
    : `Action required: Please sign – ${document}`;

  const formattedDue = new Date(dueDate + "T00:00:00").toLocaleDateString("en-CA", {
    year: "numeric", month: "long", day: "numeric",
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="background: #1a1f2e; padding: 24px 32px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; background: #4f6ef7; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 13px; flex-shrink: 0;">IR</div>
          <div>
            <div style="color: white; font-size: 13px; font-weight: 600;">Integrity Reforestation</div>
            <div style="color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 1px;">Admin Console</div>
          </div>
        </div>
      </div>

      <div style="padding: 32px;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">Hello ${recipientName},</p>

        <p style="margin: 0 0 24px; font-size: 15px; color: #111827; line-height: 1.6;">
          ${isReminder
            ? `This is a reminder that your signature is still required on the following document:`
            : `Please review and sign the following document at your earliest convenience:`}
        </p>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 6px;">${category}</div>
          <div style="font-size: 16px; font-weight: 600; color: #111827;">${document}</div>
          <div style="margin-top: 12px; display: flex; gap: 24px;">
            <div>
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; margin-bottom: 2px;">Signature Due</div>
              <div style="font-size: 13px; font-weight: 600; color: ${isReminder ? "#ef4444" : "#111827"};">${formattedDue}</div>
            </div>
          </div>
        </div>

        ${note ? `
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 600; color: #92400e; margin-bottom: 4px;">Note from HR</div>
          <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.5;">${note}</p>
        </div>` : ""}

        ${signingUrl ? `
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${signingUrl}" style="display: inline-block; padding: 14px 32px; background: #4f6ef7; color: white; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 700; letter-spacing: 0.01em;">
            ✍&nbsp; Sign Document
          </a>
          <p style="margin: 10px 0 0; font-size: 11px; color: #9ca3af;">Or copy this link: <a href="${signingUrl}" style="color: #4f6ef7;">${signingUrl}</a></p>
        </div>` : `
        <p style="margin: 0 0 24px; font-size: 13px; color: #374151; line-height: 1.6;">
          To complete your signature, please contact HR or your supervisor. Once signed, return the completed document to <a href="mailto:matt@integrity-reforestation.com" style="color: #4f6ef7;">matt@integrity-reforestation.com</a>.
        </p>`}

        <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
          If you have any questions, reply to this email or call the Integrity Reforestation office.<br>
          Thank you for your prompt attention.
        </p>
      </div>

      <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px 32px;">
        <p style="margin: 0; font-size: 11px; color: #9ca3af;">
          Sent by Integrity Reforestation Admin Console · matt@integrity-reforestation.com
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Integrity Reforestation" <${process.env.GMAIL_USER}>`,
      to: recipientEmail,
      subject,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
