#!/usr/bin/env python3
"""
Ceramics Photo Processor
Phase 1: Instagram-Ready Image Processing

Processes photos for Instagram with:
- Resize to Instagram aspect ratios (1080x1080, 1080x1350, 1080x566)
- Metadata watermark with piece name and year
- Organizes by piece in ~/clawd/ceramics/[year]/[piece-id]/
- Database integration for tracking

Usage:
  ceramics-photo add piece-123 photo1.jpg photo2.jpg --angle front
  ceramics-photo batch piece-123 ./raw-photos/ --size square
  ceramics-photo resize piece-123 --size portrait --watermark
  ceramics-photo watermark piece-123 --text "Artist Name 2026"
  ceramics-photo list piece-123
  ceramics-photo info
"""

import sqlite3
import os
import sys
import shutil
import argparse
from datetime import datetime
from pathlib import Path

# Paths
PHOTO_DIR = os.path.expanduser("~/clawd/ceramics/photos")
DB_PATH = os.path.expanduser("~/clawd/ceramics/ceramics.sqlite")

# Standard dimensions for web/social
SIZES = {
    'web': (1200, 1200),
    'social': (1080, 1080),
    'thumbnail': (300, 300),
    'etsy': (2000, 2000),
    'instagram-square': (1080, 1080),      # 1:1 Instagram feed
    'instagram-portrait': (1080, 1350),    # 4:5 Instagram portrait
    'instagram-landscape': (1080, 566),    # 1.91:1 Instagram landscape
    'instagram-story': (1080, 1920),       # 9:16 Instagram story/Reels
}

PHOTO_ANGLES = ['front', 'side', 'detail', 'studio', 'lifestyle', 'back', 'top', 'bottom', 'other']

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_year_dir(year=None):
    """Get photo directory for year"""
    if year is None:
        year = datetime.now().strftime('%Y')
    year_dir = os.path.join(PHOTO_DIR, str(year))
    Path(year_dir).mkdir(parents=True, exist_ok=True)
    return year_dir

def generate_filename(piece_id, angle, timestamp=None, ext='.jpg'):
    """Generate standardized photo filename"""
    if timestamp is None:
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    return f"{piece_id}-{angle}-{timestamp}{ext}"

def has_pil():
    """Check if PIL is available"""
    try:
        from PIL import Image, ImageDraw, ImageFont
        return True
    except ImportError:
        return False

def process_image(input_path, output_path, size=None, quality=95, watermark_text=None):
    """
    Process image - resize and optimize for Instagram
    
    Args:
        input_path: Source image path
        output_path: Destination path
        size: Tuple of (width, height) or None for original size
        quality: JPEG quality (1-100)
        watermark_text: Optional text watermark
    
    Returns:
        bool: True if successful
    """
    if not has_pil():
        print(f"⚠️  PIL/Pillow not available, copying without processing: {os.path.basename(input_path)}")
        shutil.copy2(input_path, output_path)
        return True
    
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        with Image.open(input_path) as img:
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            
            # Resize if size specified
            if size:
                # Resize maintaining aspect ratio
                img.thumbnail((size[0], size[1]), Image.LANCZOS)
                
                # Create new image with target size and paste centered
                new_img = Image.new('RGB', size, (255, 255, 255))
                x = (size[0] - img.width) // 2
                y = (size[1] - img.height) // 2
                new_img.paste(img, (x, y))
                img = new_img
            
            # Add watermark if provided
            if watermark_text:
                draw = ImageDraw.Draw(img)
                
                # Try to load a font
                try:
                    # Try common font paths
                    font_paths = [
                        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
                        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
                        "/System/Library/Fonts/Helvetica.ttc",  # macOS
                        "C:/Windows/Fonts/arial.ttf",  # Windows
                    ]
                    
                    font = None
                    for fp in font_paths:
                        if os.path.exists(fp):
                            # Scale font size based on image size
                            font_size = max(16, min(img.width, img.height) // 40)
                            font = ImageFont.truetype(fp, font_size)
                            break
                    
                    if font is None:
                        font = ImageFont.load_default()
                except:
                    font = ImageFont.load_default()
                
                # Calculate text position (bottom right with padding)
                bbox = draw.textbbox((0, 0), watermark_text, font=font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]
                padding = max(10, min(img.width, img.height) // 50)
                
                x = img.width - text_width - padding
                y = img.height - text_height - padding
                
                # Draw shadow/outline
                shadow_color = (0, 0, 0, 128)
                for dx in [-2, -1, 1, 2]:
                    for dy in [-2, -1, 1, 2]:
                        draw.text((x+dx, y+dy), watermark_text, font=font, fill=shadow_color)
                
                # Draw main text
                draw.text((x, y), watermark_text, font=font, fill=(255, 255, 255, 255))
            
            # Save with optimization
            img.save(output_path, 'JPEG', quality=quality, optimize=True)
            
        return True
    except Exception as e:
        print(f"Error processing {input_path}: {e}")
        return False

def add_metadata_watermark(input_path, output_path, piece_name, artist_name=None, year=None):
    """
    Add metadata watermark with piece name, artist, and year
    
    Args:
        input_path: Source image path
        output_path: Destination path
        piece_name: Name of the piece
        artist_name: Artist name (optional)
        year: Year (defaults to current)
    
    Returns:
        bool: True if successful
    """
    if year is None:
        year = datetime.now().year
    
    # Build watermark text
    if artist_name:
        watermark_text = f"{piece_name} | {artist_name} {year}"
    else:
        watermark_text = f"{piece_name} | {year}"
    
    return process_image(input_path, output_path, watermark_text=watermark_text)

def cmd_add(args):
    """Add photos for a piece"""
    piece_id = args.piece_id
    input_files = args.files
    
    print(f"📸 Adding photos for: {piece_id}")
    print(f"   Input files: {len(input_files)}")
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Check piece exists
    cursor.execute("SELECT id, name FROM pieces WHERE id = ?", (piece_id,))
    piece = cursor.fetchone()
    
    if not piece:
        print(f"❌ Piece not found: {piece_id}")
        conn.close()
        return 1
    
    piece_name = piece['name']
    
    # Get year from args or use current
    year = args.year or datetime.now().strftime('%Y')
    piece_dir = os.path.join(PHOTO_DIR, str(year), piece_id)
    Path(piece_dir).mkdir(parents=True, exist_ok=True)
    
    added = 0
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    
    for i, input_file in enumerate(input_files):
        if not os.path.exists(input_file):
            print(f"  ⚠️  Skipping (not found): {input_file}")
            continue
        
        # Check file extension
        ext = os.path.splitext(input_file)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.tiff', '.tif']:
            print(f"  ⚠️  Skipping {input_file} (unsupported format: {ext})")
            continue
        
        # Determine angle
        if args.angles and i < len(args.angles):
            angle = args.angles[i]
        else:
            angle = args.angle or 'other'
        
        # Generate filename
        filename = generate_filename(piece_id, angle, timestamp, ext='.jpg')
        output_path = os.path.join(piece_dir, filename)
        
        # Process the image
        watermark_text = None
        if args.watermark:
            watermark_text = f"{piece_name} | {year}"
        
        if args.process:
            size = SIZES.get(args.size)
            if process_image(input_file, output_path, size, watermark_text=watermark_text):
                print(f"  ✓ Added: {filename} ({angle})")
                added += 1
            else:
                print(f"  ✗ Failed: {filename}")
                continue
        else:
            # Just copy
            if args.watermark and has_pil():
                if process_image(input_file, output_path, watermark_text=watermark_text):
                    print(f"  ✓ Added: {filename} ({angle})")
                    added += 1
                else:
                    shutil.copy2(input_file, output_path)
                    print(f"  ✓ Added: {filename} ({angle}) [no processing]")
                    added += 1
            else:
                shutil.copy2(input_file, output_path)
                print(f"  ✓ Added: {filename} ({angle})")
                added += 1
        
        # Add to database
        rel_path = os.path.join(str(year), piece_id, filename)
        is_primary = 1 if (args.primary and i == 0) else 0
        
        cursor.execute("""
            INSERT INTO photos (piece_id, path, angle, is_primary)
            VALUES (?, ?, ?, ?)
        """, (piece_id, rel_path, angle, is_primary))
    
    conn.commit()
    conn.close()
    
    print(f"\n✅ Added {added} photos to {piece_id}")
    print(f"   Location: {piece_dir}")
    
    return 0

def cmd_batch(args):
    """Batch process photos in a directory"""
    input_dir = args.input_dir
    piece_id = args.piece_id
    
    if not os.path.isdir(input_dir):
        print(f"❌ Directory not found: {input_dir}")
        return 1
    
    # Find image files
    image_exts = {'.jpg', '.jpeg', '.png', '.tiff', '.tif'}
    files = [f for f in os.listdir(input_dir) 
             if os.path.splitext(f.lower())[1] in image_exts]
    files.sort()
    
    if not files:
        print(f"❌ No images found in: {input_dir}")
        return 1
    
    print(f"📁 Found {len(files)} images in: {input_dir}")
    
    # Convert to full paths
    full_paths = [os.path.join(input_dir, f) for f in files]
    
    # Set up args for cmd_add
    args.files = full_paths
    args.year = args.year or datetime.now().strftime('%Y')
    args.angle = args.angle or 'front'
    args.angles = None
    args.process = not args.no_process
    args.size = args.size or 'web'
    args.primary = True
    args.watermark = args.watermark
    
    return cmd_add(args)

def cmd_resize(args):
    """Resize existing photos for Instagram"""
    if not has_pil():
        print("❌ PIL/Pillow required for resizing")
        print("   Install with: pip install Pillow")
        return 1
    
    piece_id = args.piece_id
    year = args.year or datetime.now().strftime('%Y')
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, name FROM pieces WHERE id = ?", (piece_id,))
    piece = cursor.fetchone()
    
    if not piece:
        print(f"❌ Piece not found: {piece_id}")
        conn.close()
        return 1
    
    piece_dir = os.path.join(PHOTO_DIR, str(year), piece_id)
    
    if not os.path.exists(piece_dir):
        print(f"❌ Photo directory not found: {piece_dir}")
        conn.close()
        return 1
    
    # Get photos from database
    cursor.execute("SELECT * FROM photos WHERE piece_id = ?", (piece_id,))
    photos = cursor.fetchall()
    
    if not photos:
        print(f"❌ No photos found for piece: {piece_id}")
        conn.close()
        return 1
    
    size = SIZES.get(args.size)
    if not size:
        print(f"❌ Unknown size: {args.size}")
        conn.close()
        return 1
    
    size_name = args.size.replace('instagram-', '')
    output_dir = os.path.join(piece_dir, f"instagram-{size_name}")
    Path(output_dir).mkdir(exist_ok=True)
    
    print(f"🔄 Resizing {len(photos)} photos for {args.size} ({size[0]}x{size[1]})")
    
    watermark_text = None
    if args.watermark:
        watermark_text = f"{piece['name']} | {year}"
    
    processed = 0
    for ph in photos:
        input_path = os.path.join(PHOTO_DIR, ph['path'])
        
        if not os.path.exists(input_path):
            print(f"  ⚠️  Not found: {ph['path']}")
            continue
        
        filename = os.path.basename(ph['path'])
        name, ext = os.path.splitext(filename)
        output_filename = f"{name}-{size_name}.jpg"
        output_path = os.path.join(output_dir, output_filename)
        
        if process_image(input_path, output_path, size, quality=args.quality, watermark_text=watermark_text):
            print(f"  ✓ {output_filename}")
            processed += 1
        else:
            print(f"  ✗ Failed: {filename}")
    
    print(f"\n✅ Processed {processed} photos")
    print(f"   Output: {output_dir}")
    
    conn.close()
    return 0

def cmd_watermark(args):
    """Add watermark to existing photos"""
    if not has_pil():
        print("❌ PIL/Pillow required for watermarking")
        print("   Install with: pip install Pillow")
        return 1
    
    piece_id = args.piece_id
    year = args.year or datetime.now().strftime('%Y')
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, name FROM pieces WHERE id = ?", (piece_id,))
    piece = cursor.fetchone()
    
    if not piece:
        print(f"❌ Piece not found: {piece_id}")
        conn.close()
        return 1
    
    watermark_text = args.text or f"{piece['name']} | {year}"
    
    piece_dir = os.path.join(PHOTO_DIR, str(year), piece_id)
    
    if not os.path.exists(piece_dir):
        print(f"❌ Photo directory not found: {piece_dir}")
        conn.close()
        return 1
    
    # Get photos from database
    cursor.execute("SELECT * FROM photos WHERE piece_id = ?", (piece_id,))
    photos = cursor.fetchall()
    
    if not photos:
        print(f"❌ No photos found for piece: {piece_id}")
        conn.close()
        return 1
    
    output_dir = os.path.join(piece_dir, "watermarked")
    Path(output_dir).mkdir(exist_ok=True)
    
    print(f"🖼️  Adding watermark to {len(photos)} photos")
    print(f"   Text: '{watermark_text}'")
    
    processed = 0
    for ph in photos:
        input_path = os.path.join(PHOTO_DIR, ph['path'])
        
        if not os.path.exists(input_path):
            continue
        
        filename = os.path.basename(ph['path'])
        output_path = os.path.join(output_dir, filename)
        
        if process_image(input_path, output_path, size=None, watermark_text=watermark_text):
            print(f"  ✓ {filename}")
            processed += 1
    
    print(f"\n✅ Watermarked {processed} photos")
    print(f"   Output: {output_dir}")
    
    conn.close()
    return 0

def cmd_list(args):
    """List photos for a piece"""
    piece_id = args.piece_id
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT p.*, pieces.name as piece_name 
        FROM photos p 
        JOIN pieces ON p.piece_id = pieces.id 
        WHERE p.piece_id = ? 
        ORDER BY p.timestamp
    """, (piece_id,))
    photos = cursor.fetchall()
    
    if not photos:
        print(f"📭 No photos found for: {piece_id}")
        conn.close()
        return 0
    
    print(f"📸 Photos for {photos[0]['piece_name']} ({piece_id}):")
    print("-" * 60)
    
    for ph in photos:
        primary = "⭐" if ph['is_primary'] else "  "
        full_path = os.path.join(PHOTO_DIR, ph['path'])
        exists = "✓" if os.path.exists(full_path) else "✗"
        print(f"{primary} {exists} {ph['angle']:10} | {ph['path']}")
    
    conn.close()
    return 0

def cmd_info(args):
    """Show photo directory info"""
    print("📁 Ceramics Photo Organization System")
    print("=" * 60)
    print(f"Base directory: {PHOTO_DIR}")
    print(f"PIL/Pillow: {'✅ Available' if has_pil() else '❌ Not installed (pip install Pillow)'}")
    print()
    
    # List years
    if os.path.exists(PHOTO_DIR):
        years = [d for d in os.listdir(PHOTO_DIR) 
                 if os.path.isdir(os.path.join(PHOTO_DIR, d)) and d.isdigit()]
        years.sort(reverse=True)
        
        for year in years:
            year_dir = os.path.join(PHOTO_DIR, year)
            pieces = [d for d in os.listdir(year_dir) 
                     if os.path.isdir(os.path.join(year_dir, d))]
            
            # Count photos
            photo_count = 0
            for piece in pieces:
                piece_dir = os.path.join(year_dir, piece)
                photo_count += len([f for f in os.listdir(piece_dir) 
                                   if f.endswith(('.jpg', '.jpeg', '.png'))])
            
            print(f"📅 {year}: {len(pieces)} pieces, {photo_count} photos")
    
    # Database stats
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM photos")
    total_photos = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(DISTINCT piece_id) FROM photos")
    pieces_with_photos = cursor.fetchone()[0]
    
    print()
    print(f"📊 Database Stats:")
    print(f"  Total photos: {total_photos}")
    print(f"  Pieces with photos: {pieces_with_photos}")
    
    cursor.execute("SELECT angle, COUNT(*) FROM photos GROUP BY angle")
    angle_counts = cursor.fetchall()
    if angle_counts:
        print()
        print("  By angle:")
        for angle, count in angle_counts:
            print(f"    {angle}: {count}")
    
    conn.close()
    
    print()
    print("Standard angles:", ", ".join(PHOTO_ANGLES))
    print()
    print("Instagram sizes:")
    for name in ['instagram-square', 'instagram-portrait', 'instagram-landscape', 'instagram-story']:
        dims = SIZES[name]
        print(f"  • {name}: {dims[0]}x{dims[1]}px")
    print()
    print("Other sizes:")
    for name, dims in SIZES.items():
        if not name.startswith('instagram'):
            print(f"  • {name}: {dims[0]}x{dims[1]}px")
    
    return 0

def main():
    parser = argparse.ArgumentParser(
        description="Ceramics Photo Processor - Phase 1",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Add photos for a piece
  ceramics-photo add piece-123 photo1.jpg photo2.jpg --angle front
  ceramics-photo add piece-123 *.jpg --watermark

  # Batch process a directory
  ceramics-photo batch piece-123 ./raw-photos/ --size instagram-square

  # Resize existing photos for Instagram
  ceramics-photo resize piece-123 --size instagram-portrait --watermark
  ceramics-photo resize piece-123 --size instagram-square --quality 95

  # Add watermark to existing photos
  ceramics-photo watermark piece-123 --text "Artist Name 2026"

  # List photos for a piece
  ceramics-photo list piece-123

  # Show system info
  ceramics-photo info

Instagram Sizes:
  instagram-square:    1080x1080 (1:1, feed)
  instagram-portrait:  1080x1350 (4:5, portrait)
  instagram-landscape: 1080x566  (1.91:1, landscape)
  instagram-story:     1080x1920 (9:16, stories/Reels)
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # Add command
    add_parser = subparsers.add_parser('add', help='Add photos for a piece')
    add_parser.add_argument('piece_id', help='Piece ID')
    add_parser.add_argument('files', nargs='+', help='Photo files')
    add_parser.add_argument('--angle', choices=PHOTO_ANGLES, default='other',
                           help='Photo angle')
    add_parser.add_argument('--angles', nargs='+', help='Angles for each photo')
    add_parser.add_argument('--year', help='Year directory (default: current)')
    add_parser.add_argument('--process', action='store_true', help='Process/resize')
    add_parser.add_argument('--size', choices=list(SIZES.keys()), default='web',
                           help='Target size')
    add_parser.add_argument('--primary', action='store_true', 
                           help='First photo is primary')
    add_parser.add_argument('--watermark', action='store_true',
                           help='Add metadata watermark')
    
    # Batch command
    batch_parser = subparsers.add_parser('batch', help='Batch process directory')
    batch_parser.add_argument('piece_id', help='Piece ID')
    batch_parser.add_argument('input_dir', help='Input directory')
    batch_parser.add_argument('--year', help='Year directory')
    batch_parser.add_argument('--angle', choices=PHOTO_ANGLES, default='front')
    batch_parser.add_argument('--no-process', action='store_true',
                             help='Skip processing')
    batch_parser.add_argument('--size', choices=list(SIZES.keys()), default='web')
    batch_parser.add_argument('--watermark', action='store_true',
                             help='Add metadata watermark')
    
    # Resize command
    resize_parser = subparsers.add_parser('resize', help='Resize for Instagram')
    resize_parser.add_argument('piece_id', help='Piece ID')
    resize_parser.add_argument('--year', help='Year directory')
    resize_parser.add_argument('--size', choices=list(SIZES.keys()), 
                               default='instagram-square',
                               help='Target size')
    resize_parser.add_argument('--quality', type=int, default=95,
                              help='JPEG quality (1-100)')
    resize_parser.add_argument('--watermark', action='store_true',
                              help='Add metadata watermark')
    
    # Watermark command
    watermark_parser = subparsers.add_parser('watermark', help='Add watermark to photos')
    watermark_parser.add_argument('piece_id', help='Piece ID')
    watermark_parser.add_argument('--year', help='Year directory')
    watermark_parser.add_argument('--text', help='Custom watermark text')
    
    # List command
    list_parser = subparsers.add_parser('list', help='List photos for piece')
    list_parser.add_argument('piece_id', help='Piece ID')
    
    # Info command
    info_parser = subparsers.add_parser('info', help='Show photo system info')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    commands = {
        'add': cmd_add,
        'batch': cmd_batch,
        'resize': cmd_resize,
        'watermark': cmd_watermark,
        'list': cmd_list,
        'info': cmd_info,
    }
    
    return commands[args.command](args)

if __name__ == '__main__':
    sys.exit(main())
