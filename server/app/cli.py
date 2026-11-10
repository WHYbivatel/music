import argparse
import getpass
import sys

from sqlalchemy import select

from .config import get_settings
from .db import SessionLocal
from .models import Account, UserSettings, Wallet, utcnow
from .catalog import DEFAULT_DRAFT
from .security import check_name, check_password_shape, hash_password, normalize_email
from .wallet import apply_entry


def create_admin(email: str, name: str, password: str) -> None:
    email = normalize_email(email)
    name = check_name(name)
    check_password_shape(password)
    db = SessionLocal()
    try:
        existing = db.scalar(select(Account).where(Account.email == email))
        if existing:
            existing.role = "admin"
            existing.password_hash = hash_password(password)
            existing.password_changed_at = utcnow()
            existing.display_name = name
            db.commit()
            print("updated")
            return
        account = Account(kind="user", email=email, display_name=name, role="admin", password_hash=hash_password(password), password_changed_at=utcnow())
        db.add(account)
        db.flush()
        db.add(Wallet(account_id=account.id))
        db.flush()
        settings = get_settings()
        if settings.test_signup_tokens > 0:
            apply_entry(db, account.id, bucket="test", business_key=f"signup-test:{account.id}", kind="credit", amount=settings.test_signup_tokens, label="op.testGrant")
        db.add(UserSettings(account_id=account.id, draft=dict(DEFAULT_DRAFT)))
        db.commit()
        print("created")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="NEON SOUND maintenance")
    sub = parser.add_subparsers(dest="command", required=True)
    admin = sub.add_parser("create-admin")
    admin.add_argument("--email", required=True)
    admin.add_argument("--name", default="Администратор")
    admin.add_argument("--password-file", help="Read the password from a file. Do not pass it on the command line.")
    args = parser.parse_args()
    if args.command == "create-admin":
        if args.password_file:
            password = open(args.password_file, encoding="utf-8").read().strip()
        elif sys.stdin.isatty():
            password = getpass.getpass("Password: ")
            again = getpass.getpass("Repeat: ")
            if password != again:
                raise SystemExit("passwords do not match")
        else:
            raise SystemExit("Refusing to read a password from the terminal history. Use --password-file or a TTY.")
        create_admin(args.email, args.name, password)


if __name__ == "__main__":
    main()
