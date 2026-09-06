import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
EVENTS_PATH = SITE / "data" / "events.json"
PHOTOS_PATH = SITE / "data" / "photos.json"
OUTPUT_PATH = SITE / "img" / "orbit-atlas.webp"

COLUMNS = 11
ROWS = 8
CELL_WIDTH = 160
CELL_HEIGHT = 120


def main():
    events = json.loads(EVENTS_PATH.read_text(encoding="utf-8"))
    photo_data = json.loads(PHOTOS_PATH.read_text(encoding="utf-8"))
    photos_by_folder = {chapter["folder"]: chapter["photos"] for chapter in photo_data["chapters"]}
    photos = [photo for event in events for photo in photos_by_folder.get(event["folder"], [])]

    capacity = COLUMNS * ROWS
    if len(photos) > capacity:
        raise ValueError(f"图集容量只有 {capacity} 张，实际有 {len(photos)} 张")

    atlas = Image.new("RGB", (COLUMNS * CELL_WIDTH, ROWS * CELL_HEIGHT), (240, 237, 247))
    for index, photo in enumerate(photos):
        source = SITE / photo["thumb"]
        with Image.open(source) as image:
            image = ImageOps.exif_transpose(image).convert("RGB")
            tile = ImageOps.fit(
                image,
                (CELL_WIDTH, CELL_HEIGHT),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
            x = (index % COLUMNS) * CELL_WIDTH
            y = (index // COLUMNS) * CELL_HEIGHT
            atlas.paste(tile, (x, y))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUTPUT_PATH, "WEBP", quality=58, method=6)
    print(f"{len(photos)} photos -> {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
