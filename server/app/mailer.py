import smtplib
from email.message import EmailMessage

from .config import Settings, get_settings


class UnavailableMailer:
    configured = False

    def send_password_reset(self, to: str, link: str) -> None:
        raise RuntimeError("mail is not configured")


class SmtpMailer:
    configured = True

    def __init__(self, settings: Settings):
        self.settings = settings

    def send_password_reset(self, to: str, link: str) -> None:
        message = EmailMessage()
        message["Subject"] = "ÄUEN password reset"
        message["From"] = self.settings.smtp_from or self.settings.smtp_user
        message["To"] = to
        message.set_content(f"Reset your ÄUEN password:\n{link}\n\nThe link expires soon. If you did not ask, ignore this message.\n")
        with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            if self.settings.smtp_user:
                smtp.login(self.settings.smtp_user, self.settings.smtp_password)
            smtp.send_message(message)


def get_mailer():
    settings = get_settings()
    if settings.smtp_host and settings.smtp_from:
        return SmtpMailer(settings)
    return UnavailableMailer()
