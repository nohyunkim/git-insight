from pathlib import Path
import sys


ROOT_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT_DIR / 'frontend'
PUBLIC_DIR = FRONTEND_DIR / 'public'
ADSENSE_MARKER = 'ca-pub-6215904837522556'
ADS_TXT_CONTENT = 'google.com, pub-6215904837522556, DIRECT, f08c47fec0942fa0'

REQUIRED_STATIC_PAGES = (
    'guide.html',
    'github-portfolio-guide.html',
    'readme-writing-guide.html',
    'github-activity-interpretation.html',
)

EXCLUDED_STATIC_PAGES = (
    'about.html',
    'faq.html',
    'privacy.html',
    'terms.html',
    'commit-message-guide.html',
    'pr-description-guide.html',
)


def assert_contains(path: Path, needle: str, label: str, errors: list[str]):
    content = path.read_text(encoding='utf-8')
    if needle not in content:
        errors.append(f'{label}: expected marker was not found in {path.relative_to(ROOT_DIR)}')


def assert_not_contains(path: Path, needle: str, label: str, errors: list[str]):
    content = path.read_text(encoding='utf-8')
    if needle in content:
        errors.append(f'{label}: unexpected marker was found in {path.relative_to(ROOT_DIR)}')


def main():
    errors: list[str] = []

    ads_path = PUBLIC_DIR / 'ads.txt'
    if not ads_path.exists():
        errors.append('ads.txt: frontend/public/ads.txt file is missing')
    else:
        ads_content = ads_path.read_text(encoding='utf-8').strip()
        if ads_content != ADS_TXT_CONTENT:
            errors.append('ads.txt: content does not match the expected publisher line')

    assert_contains(FRONTEND_DIR / 'index.html', ADSENSE_MARKER, 'index.html', errors)

    for filename in REQUIRED_STATIC_PAGES:
        assert_contains(PUBLIC_DIR / filename, ADSENSE_MARKER, filename, errors)

    for filename in EXCLUDED_STATIC_PAGES:
        assert_not_contains(PUBLIC_DIR / filename, ADSENSE_MARKER, filename, errors)

    if errors:
        for error in errors:
            print(error)
        return 1

    print('Public page checks passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
