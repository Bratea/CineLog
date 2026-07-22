from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "src/assets/branding/cinelog-app-icon-pixel.png"


def resize(source: Image.Image, size: int, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    source.resize((size, size), Image.Resampling.LANCZOS).save(
        destination, "PNG", optimize=True
    )


def extract_foreground(source: Image.Image) -> Image.Image:
    """Remove the blue backdrop while retaining the warm and lime emblem."""
    rgba = source.convert("RGBA")
    pixels = []
    for red, green, blue, _ in rgba.get_flattened_data():
        non_blue_signal = max(red - blue, green - blue)
        alpha = max(0, min(255, round((non_blue_signal - 24) * 255 / 72)))
        pixels.append((red, green, blue, alpha))
    rgba.putdata(pixels)
    return rgba


def main() -> None:
    master = Image.open(MASTER).convert("RGB")

    master.save(ROOT / "src/assets/branding/cinelog-app-icon.png", "PNG", optimize=True)

    for size, name in ((64, "favicon.png"), (192, "icon-192.png"), (512, "icon-512.png")):
        resize(master, size, ROOT / "public" / name)

    densities = {
        "mdpi": (48, 108),
        "hdpi": (72, 162),
        "xhdpi": (96, 216),
        "xxhdpi": (144, 324),
        "xxxhdpi": (192, 432),
    }
    foreground = extract_foreground(master)
    for density, (legacy_size, foreground_size) in densities.items():
        folder = ROOT / "android/app/src/main/res" / f"mipmap-{density}"
        resize(master, legacy_size, folder / "ic_launcher.png")
        resize(master, legacy_size, folder / "ic_launcher_round.png")
        resize(foreground, foreground_size, folder / "ic_launcher_foreground.png")


if __name__ == "__main__":
    main()
