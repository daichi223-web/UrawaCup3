"""
PDF生成用共通ユーティリティ

日本語フォント登録のフォールバックチェーン:
  Windows (游ゴシック/MSゴシック/メイリオ) → Linux Noto CJK → CID HeiseiKakuGo → Helvetica
"""

import os
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def register_japanese_font() -> str:
    """利用可能な日本語フォントを登録して名前を返す"""
    font_candidates = [
        # Windows 標準フォント
        ('YuGothic', r'C:\Windows\Fonts\YuGothR.ttc', 0),
        ('MSGothic', r'C:\Windows\Fonts\msgothic.ttc', 0),
        ('Meiryo', r'C:\Windows\Fonts\meiryo.ttc', 0),
        ('MSMincho', r'C:\Windows\Fonts\msmincho.ttc', 0),
        # Linux IPA Gothic (Docker / Render) - TrueType形式
        ('IPAGothic', '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf', None),
    ]

    for font_name, font_path, subfont_index in font_candidates:
        if os.path.exists(font_path):
            try:
                if subfont_index is not None:
                    pdfmetrics.registerFont(TTFont(font_name, font_path, subfontIndex=subfont_index))
                else:
                    pdfmetrics.registerFont(TTFont(font_name, font_path))
                return font_name
            except Exception:
                continue

    # CID フォントにフォールバック
    try:
        from reportlab.pdfbase.cidfonts import UnicodeCIDFont
        pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
        return 'HeiseiKakuGo-W5'
    except Exception:
        pass

    return 'Helvetica'
