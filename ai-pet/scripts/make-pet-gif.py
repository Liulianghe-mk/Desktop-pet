"""从 public/yarni-pet.png 生成透明背景悬浮 GIF。"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "yarni-pet.png"
OUT = ROOT / "public" / "yarni-pet.gif"


def remove_background(img: Image.Image, threshold: int = 45) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if red < threshold and green < threshold and blue < threshold:
                pixels[x, y] = (red, green, blue, 0)
            elif red > 230 and green > 230 and blue > 230:
                pixels[x, y] = (red, green, blue, 0)
    return rgba


def main() -> None:
    source = Image.open(SRC)
    alpha = source.convert("RGBA").split()[3]
    transparent_count = sum(1 for value in alpha.get_flattened_data() if value < 10)
    pet = source if transparent_count > 1000 else remove_background(source)

    frames: list[Image.Image] = []
    width, height = pet.size
    pad = 16
    for index in range(24):
        offset = int(5 * (1 if (index % 12) < 6 else -1))
        frame = Image.new("RGBA", (width, height + pad * 2), (0, 0, 0, 0))
        frame.paste(pet, (0, pad + offset), pet if pet.mode == "RGBA" else None)
        frames.append(frame)

    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=90,
        loop=0,
        disposal=2,
        optimize=False,
    )
    print(f"Generated {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
