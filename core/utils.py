"""
ユーティリティモジュール
"""

from pathlib import Path
from datetime import datetime


def load_yaml(path: Path) -> dict:
    """YAMLファイルを読み込む"""
    import yaml
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def save_yaml(path: Path, data: dict):
    """YAMLファイルを保存"""
    import yaml
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.dump(data, allow_unicode=True, default_flow_style=False),
        encoding="utf-8"
    )


def append_log(doc_repo: Path, content: str):
    """サイクルログに追記"""
    log_file = doc_repo / "cycle-log.md"
    log_file.parent.mkdir(parents=True, exist_ok=True)
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"\n---\n{datetime.now().isoformat()}\n{content}\n")
