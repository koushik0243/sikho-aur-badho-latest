import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, body, options = {}) => {
  const senderEmail = options.senderEmail || process.env.EMAIL_SENDER_ADDRESS;
  const senderName = options.senderName || process.env.EMAIL_SENDER_NAME;
  const fromAddress = senderName ? `${senderName} <${senderEmail}>` : senderEmail;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.USER_EMAIL,
      pass: process.env.USER_PASSWORD
    }
  });

  const mailOptions = {
    from: fromAddress,
    to: to,
    subject: subject,
    html: body
  };

  await transporter.sendMail(mailOptions);
};