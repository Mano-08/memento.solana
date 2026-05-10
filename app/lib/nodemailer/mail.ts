import { transporter } from "./main";

type SendOtpToEmailAddressProps = {
  otp: string;
  email: string;
};

export async function sendOtpToEmailAddress({
  otp,
  email,
}: SendOtpToEmailAddressProps) {
  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      html: `<p>Your OTP code is: <strong>${otp}</strong>.</p>`,
    });
    return {
      error: false,
      message: "OTP email sent successfully",
    };
  } catch (err: any) {
    console.error("Failed:", err?.message || err);
    return {
      error: true,
      message: err?.message
        ? `Failed to send OTP email: ${err.message}`
        : "Failed to send OTP email",
    };
  }
}

// type SendClaimGiftRemainderProps = {
//   gifts: { recipientEmail: string; giftPda: string; senderEmail: string }[];
// };

// export async function sendClaimGiftRemainder({
//   gifts,
// }: SendClaimGiftRemainderProps) {
//   const results: Array<{
//     email: string;
//     status: "sent" | "error";
//     message?: string;
//   }> = [];

//   for (const gift of gifts) {
//     const { recipientEmail, giftPda, senderEmail } = gift;
//     const claimUrl = `http://localhost:3000/claim/${giftPda}`;
//     try {
//       await transporter.sendMail({
//         from: process.env.GMAIL_USER,
//         to: recipientEmail,
//         subject: "You have an unclaimed gift on Memento!",
//         html: `
//           <p>Hello,</p>
//           <p>You have a gift waiting for you from <strong>${senderEmail}</strong>!</p>
//           <p>
//             To claim your gift, click the following link:<br/>
//             <a href="${claimUrl}">${claimUrl}</a>
//           </p>
//           <p>If you believe you received this email in error, you can ignore it.</p>
//           <p>Best regards,<br/>Memento Team</p>
//         `,
//       });
//       results.push({ email: recipientEmail, status: "sent" });
//     } catch (err: any) {
//       console.error(
//         `Failed to send claim email to ${recipientEmail}:`,
//         err?.message || err
//       );
//       results.push({
//         email: recipientEmail,
//         status: "error",
//         message: err?.message
//           ? `Failed to send: ${err.message}`
//           : "Failed to send email",
//       });
//     }
//   }

//   return results;
// }
