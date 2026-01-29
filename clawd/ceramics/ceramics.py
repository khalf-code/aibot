#!/usr/bin/env python3
"""
Ceramics Business Intelligence CLI
Phase 1: Foundation System

Unified CLI for managing ceramics inventory, photos, and social posts.

Commands:
  add     - Add new piece with interactive prompts
  list    - View inventory with filters
  update  - Update piece status or metadata
  post    - Generate social media content for a piece
  photo   - Process and organize photos
  stats   - Show business statistics

Status Workflow:
  in-progress → ready-for-sale → listed → sold → archived
"""

import sqlite3
import argparse
import os
import sys
import shutil
from datetime import datetime
from pathlib import Path

# Database path
DB_PATH = os.path.expanduser("~/clawd/ceramics/ceramics.sqlite")
PHOTO_DIR = os.path.expanduser("~/clawd/ceramics/photos")

# Status and type enums
STATUSES = ['in-progress', 'ready-for-sale', 'listed', 'sold', 'archived', 'gifted']
TYPES = ['vase', 'bowl', 'plate', 'mug', 'sculpture', 'planter', 'other']
FIRING_TYPES = ['bisque', 'glaze', 'raku', 'wood', 'gas', 'electric']
PLATFORMS = ['etsy', 'shopify', 'instagram', 'in-person', 'gallery', 'show', 'wholesale', 'custom', 'other']
PHOTO_ANGLES = ['front', 'side', 'detail', 'studio', 'lifestyle', 'back', 'top', 'bottom', 'other']

# Status workflow definition
STATUS_FLOW = {
    'in-progress': ['ready-for-sale', 'archived'],
    'ready-for-sale': ['listed', 'archived', 'in-progress'],
    'listed': ['sold', 'archived', 'ready-for-sale'],
    'sold': ['archived'],
    'archived': ['in-progress', 'ready-for-sale'],
    'gifted': []
}

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def generate_piece_id(name):
    """Generate unique piece ID from name and timestamp"""
    prefix = name.lower().replace(' ', '-').replace("'", "")[:20]
    timestamp = datetime.now().strftime('%Y%m%d%H%M')
    return f"{prefix}-{timestamp}"

def format_piece(row):
    """Format piece data for display"""
    status_icons = {
        'in-progress': '🔨',
        'ready-for-sale': '✨',
        'listed': '🏷️',
        'sold': '💰',
        'archived': '📦',
        'gifted': '🎁'
    }
    icon = status_icons.get(row['status'], '•')
    price_str = f"${row['price']:.2f}" if row['price'] else "N/A"
    return f"{icon} {row['id']} | {row['name']} ({row['type']}) | {row['glaze']} | {price_str} | {row['status']}"

def is_valid_status_transition(from_status, to_status):
    """Check if status transition is valid according to workflow"""
    if from_status == to_status:
        return True
    allowed = STATUS_FLOW.get(from_status, [])
    return to_status in allowed

# =============================================================================
# COMMAND: add - Add new piece
# =============================================================================

def cmd_add(args):
    """Add new piece interactively"""
    print("🔨 Add New Ceramic Piece")
    print("=" * 60)
    
    # Get inputs
    name = input("Piece name: ").strip()
    if not name:
        print("❌ Name is required")
        return 1
    
    print(f"Types: {', '.join(TYPES)}")
    piece_type = input("Type: ").strip()
    if piece_type not in TYPES:
        print(f"❌ Invalid type. Must be one of: {', '.join(TYPES)}")
        return 1
    
    dimensions = input("Dimensions (e.g., '8x12x6 in'): ").strip()
    
    glaze = input("Glaze name: ").strip()
    if not glaze:
        print("❌ Glaze is required")
        return 1
    
    price_input = input("Price (USD): ").strip()
    try:
        price = float(price_input) if price_input else None
    except ValueError:
        print("❌ Invalid price")
        return 1
    
    cost_input = input("Production cost (USD): ").strip()
    try:
        cost = float(cost_input) if cost_input else None
    except ValueError:
        print("❌ Invalid cost")
        return 1
    
    series = input("Series name (optional): ").strip() or None
    
    print(f"Firing types: {', '.join(FIRING_TYPES)}")
    firing = input("Firing type (optional): ").strip() or None
    if firing and firing not in FIRING_TYPES:
        print(f"❌ Invalid firing type. Must be one of: {', '.join(FIRING_TYPES)}")
        return 1
    
    materials = input("Materials (e.g., 'Stoneware, cone 6'): ").strip() or None
    notes = input("Notes: ").strip() or None
    
    # Generate ID and insert
    piece_id = generate_piece_id(name)
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO pieces (id, name, type, dimensions, glaze, price, cost, 
                              series, firing_type, materials, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in-progress')
        """, (piece_id, name, piece_type, dimensions, glaze, price, cost, 
              series, firing, materials, notes))
        conn.commit()
        print(f"\n✅ Piece added: {piece_id}")
        print(f"   Status: in-progress")
        
        # Create photo directory for the year
        year = datetime.now().strftime('%Y')
        piece_photo_dir = os.path.join(PHOTO_DIR, year, piece_id)
        Path(piece_photo_dir).mkdir(parents=True, exist_ok=True)
        print(f"   Photo directory: {piece_photo_dir}")
        
        # Add photos if provided
        if args.photos:
            print(f"\n📸 Processing {len(args.photos)} photo(s)...")
            for i, photo_path in enumerate(args.photos):
                if os.path.exists(photo_path):
                    # Copy to photo directory
                    ext = os.path.splitext(photo_path)[1].lower()
                    if ext not in ['.jpg', '.jpeg', '.png']:
                        print(f"   ⚠️  Skipping {photo_path} (unsupported format)")
                        continue
                    
                    angle = args.angles[i] if args.angles and i < len(args.angles) else 'other'
                    filename = f"{piece_id}-{angle}-{datetime.now().strftime('%Y%m%d%H%M%S')}{ext}"
                    dest_path = os.path.join(piece_photo_dir, filename)
                    shutil.copy2(photo_path, dest_path)
                    
                    # Add to database
                    rel_path = os.path.join(year, piece_id, filename)
                    is_primary = 1 if i == 0 else 0
                    cursor.execute("""
                        INSERT INTO photos (piece_id, path, angle, is_primary)
                        VALUES (?, ?, ?, ?)
                    """, (piece_id, rel_path, angle, is_primary))
                    print(f"   ✓ Added: {filename} ({angle})")
                else:
                    print(f"   ⚠️  Photo not found: {photo_path}")
            conn.commit()
        
    except sqlite3.IntegrityError as e:
        print(f"❌ Database error: {e}")
        return 1
    finally:
        conn.close()
    
    return 0

# =============================================================================
# COMMAND: list - List inventory
# =============================================================================

def cmd_list(args):
    """List inventory with filters"""
    conn = get_db()
    cursor = conn.cursor()
    
    query = "SELECT * FROM pieces WHERE 1=1"
    params = []
    
    if args.status:
        query += " AND status = ?"
        params.append(args.status)
    
    if args.series:
        query += " AND series = ?"
        params.append(args.series)
    
    if args.glaze:
        query += " AND glaze LIKE ?"
        params.append(f"%{args.glaze}%")
    
    if args.type:
        query += " AND type = ?"
        params.append(args.type)
    
    if args.min_price is not None:
        query += " AND price >= ?"
        params.append(args.min_price)
    
    if args.max_price is not None:
        query += " AND price <= ?"
        params.append(args.max_price)
    
    query += " ORDER BY created_date DESC"
    
    if args.limit:
        query += " LIMIT ?"
        params.append(args.limit)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    if not rows:
        print("📭 No pieces found matching criteria")
        conn.close()
        return 0
    
    # Summary stats
    cursor.execute("SELECT COUNT(*) FROM pieces")
    total = cursor.fetchone()[0]
    
    # Status breakdown
    cursor.execute("SELECT status, COUNT(*) FROM pieces GROUP BY status")
    status_counts = {row[0]: row[1] for row in cursor.fetchall()}
    
    print(f"📦 Inventory ({len(rows)} shown, {total} total)")
    print("=" * 80)
    
    for row in rows:
        print(format_piece(row))
    
    print("=" * 80)
    print("Status breakdown:")
    for status in STATUSES:
        count = status_counts.get(status, 0)
        if count > 0:
            icon = {'in-progress': '🔨', 'ready-for-sale': '✨', 'listed': '🏷️', 
                   'sold': '💰', 'archived': '📦', 'gifted': '🎁'}.get(status, '•')
            print(f"  {icon} {status}: {count}")
    
    conn.close()
    return 0

# =============================================================================
# COMMAND: update - Update piece
# =============================================================================

def cmd_update(args):
    """Update piece metadata or status"""
    piece_id = args.id
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Check piece exists
    cursor.execute("SELECT * FROM pieces WHERE id = ?", (piece_id,))
    piece = cursor.fetchone()
    
    if not piece:
        print(f"❌ Piece not found: {piece_id}")
        conn.close()
        return 1
    
    print(f"✏️  Updating: {piece['name']} ({piece_id})")
    print("-" * 50)
    
    updates = {}
    
    # Handle status change
    if args.status:
        new_status = args.status
        old_status = piece['status']
        
        if not is_valid_status_transition(old_status, new_status):
            print(f"❌ Invalid status transition: {old_status} → {new_status}")
            print(f"   Allowed transitions from '{old_status}': {', '.join(STATUS_FLOW.get(old_status, []))}")
            conn.close()
            return 1
        
        updates['status'] = new_status
        
        # Update related dates based on status
        if new_status == 'ready-for-sale' and old_status != 'ready-for-sale':
            updates['completed_date'] = datetime.now().isoformat()
        elif new_status == 'listed' and old_status != 'listed':
            updates['listed_date'] = datetime.now().isoformat()
        elif new_status == 'sold' and old_status != 'sold':
            updates['sold_date'] = datetime.now().isoformat()
    
    # Handle field updates
    if args.name:
        updates['name'] = args.name
    if args.glaze:
        updates['glaze'] = args.glaze
    if args.price is not None:
        updates['price'] = args.price
    if args.cost is not None:
        updates['cost'] = args.cost
    if args.series is not None:
        updates['series'] = args.series
    if args.dimensions is not None:
        updates['dimensions'] = args.dimensions
    if args.notes is not None:
        updates['notes'] = args.notes
    
    if not updates:
        print("No changes specified. Use --help for options.")
        conn.close()
        return 0
    
    # Build and execute update query
    set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
    values = list(updates.values()) + [piece_id]
    
    cursor.execute(f"UPDATE pieces SET {set_clause} WHERE id = ?", values)
    conn.commit()
    
    print(f"✅ Updated {len(updates)} field(s)")
    if 'status' in updates:
        print(f"   Status: {piece['status']} → {updates['status']}")
    
    conn.close()
    return 0

# =============================================================================
# COMMAND: show - Show piece details
# =============================================================================

def cmd_show(args):
    """Show piece details"""
    piece_id = args.id
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM pieces WHERE id = ?", (piece_id,))
    piece = cursor.fetchone()
    
    if not piece:
        print(f"❌ Piece not found: {piece_id}")
        conn.close()
        return 1
    
    status_icons = {
        'in-progress': '🔨',
        'ready-for-sale': '✨',
        'listed': '🏷️',
        'sold': '💰',
        'archived': '📦',
        'gifted': '🎁'
    }
    
    print(f"\n{status_icons.get(piece['status'], '•')} {piece['name']}")
    print("=" * 60)
    print(f"  ID:          {piece['id']}")
    print(f"  Type:        {piece['type']}")
    print(f"  Glaze:       {piece['glaze']}")
    print(f"  Dimensions:  {piece['dimensions'] or 'N/A'}")
    print(f"  Price:       ${piece['price']:.2f}" if piece['price'] else "  Price:       N/A")
    print(f"  Cost:        ${piece['cost']:.2f}" if piece['cost'] else "  Cost:        N/A")
    print(f"  Status:      {piece['status']}")
    print(f"  Series:      {piece['series'] or 'N/A'}")
    print(f"  Firing:      {piece['firing_type'] or 'N/A'}")
    print(f"  Materials:   {piece['materials'] or 'N/A'}")
    print(f"  Created:     {piece['created_date']}")
    print(f"  Completed:   {piece['completed_date'] or 'N/A'}")
    print(f"  Listed:      {piece['listed_date'] or 'N/A'}")
    print(f"  Sold:        {piece['sold_date'] or 'N/A'}")
    
    # Get photos
    cursor.execute("SELECT * FROM photos WHERE piece_id = ? ORDER BY is_primary DESC, timestamp", (piece_id,))
    photos = cursor.fetchall()
    
    if photos:
        print(f"\n📸 Photos ({len(photos)}):")
        for ph in photos:
            primary = " ⭐" if ph['is_primary'] else ""
            print(f"  - {ph['angle']}: {ph['path']}{primary}")
    
    # Get sales
    cursor.execute("SELECT * FROM sales WHERE piece_id = ?", (piece_id,))
    sales = cursor.fetchall()
    
    if sales:
        print(f"\n💰 Sales ({len(sales)}):")
        for s in sales:
            print(f"  - {s['sale_date']}: ${s['sale_price']:.2f} via {s['platform']}")
    
    # Get social posts
    cursor.execute("SELECT * FROM social_posts WHERE piece_id = ?", (piece_id,))
    posts = cursor.fetchall()
    
    if posts:
        print(f"\n📱 Social Posts ({len(posts)}):")
        for p in posts:
            print(f"  - {p['platform']} ({p['status']}): {p['post_date']}")
    
    if piece['notes']:
        print(f"\n📝 Notes:")
        print(f"  {piece['notes']}")
    
    # Show allowed status transitions
    allowed = STATUS_FLOW.get(piece['status'], [])
    if allowed:
        print(f"\n🔄 Allowed status transitions: {', '.join(allowed)}")
    
    conn.close()
    return 0

# =============================================================================
# COMMAND: post - Generate social post
# =============================================================================

def cmd_post(args):
    """Generate social media content for a piece"""
    import random
    
    piece_id = args.id
    style = args.style or 'aesthetic'
    platform = args.platform or 'instagram'
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM pieces WHERE id = ?", (piece_id,))
    piece = cursor.fetchone()
    
    if not piece:
        print(f"❌ Piece not found: {piece_id}")
        conn.close()
        return 1
    
    # Caption templates by style
    CAPTION_STYLES = {
        'aesthetic': [
            "{name} — {glaze} on {materials}",
            "The way the {glaze} catches light on this {type}...",
            "Quiet moments with {glaze} and clay.",
            "Finding stillness in the details. {glaze} {type}.",
        ],
        'casual': [
            "Fresh out of the kiln! This {type} came out better than expected 🎉",
            "Experimenting with {glaze} on this {type} and I'm loving how it turned out!",
            "Late night studio vibes = this {type} in {glaze} 💫",
            "Just listed this {type}! The {glaze} turned out dreamy.",
        ],
        'storytelling': [
            "This {type} started as an experiment with {glaze}. Three firings later, it's exactly what I imagined.",
            "The journey of this piece: wedging clay at midnight, glazing at dawn, pulling it from the kiln with held breath.",
            "Every {type} teaches me something. This one taught me patience with {glaze}.",
            "There's a moment when you open the kiln and the light hits just right. This {type} was that moment.",
        ],
        'technical': [
            "{glaze} over {materials}. Fired to cone 6. Dimensions: {dimensions}.",
            "Exploring the interaction between {glaze} and this clay body. {type}, {dimensions}.",
            "Testing {glaze} application techniques on {type}. Results: promising.",
            "{materials} + {glaze} = this surface. Technical notes: slow cool, heavy application.",
        ],
        'sale': [
            "Now available! {name} — {dimensions} of {glaze} goodness. DM to purchase ✨",
            "This {type} is looking for a home. {glaze}, {dimensions}, ready to ship.",
            "Shop update live! Starting with this {glaze} {type}. DM to claim.",
            "Flash sale: 20% off this {type} and others in the {series} series. Today only!",
        ],
    }
    
    HASHTAG_SETS = {
        'ceramics': ['#ceramics', '#pottery', '#handmade', '#ceramicart', '#clay'],
        'glazes': ['#glaze', '#glazetech', '#ceramicglaze', '#glazecombo', '#glazeexperiment'],
        'process': ['#wheelthrown', '#handbuilt', '#potterylife', '#studiopottery', '#makersgonnamake'],
        'community': ['#pottersofinstagram', '#ceramicist', '#potter', '#claycommunity', '#ceramicstudio'],
        'shop': ['#shopsmall', '#supportlocal', '#handmadesale', '#potterysale', '#ceramicsforsale'],
    }
    
    # Generate content
    templates = CAPTION_STYLES.get(style, CAPTION_STYLES['aesthetic'])
    template = random.choice(templates)
    
    data = {
        'name': piece['name'],
        'type': piece['type'],
        'glaze': piece['glaze'],
        'materials': piece['materials'] or 'stoneware',
        'dimensions': piece['dimensions'] or '',
        'series': piece['series'] or 'current',
    }
    
    try:
        caption = template.format(**data)
    except KeyError:
        caption = template
    
    # Generate hashtags
    all_tags = []
    all_tags.extend(HASHTAG_SETS['ceramics'])
    all_tags.extend(HASHTAG_SETS['process'])
    all_tags.extend(HASHTAG_SETS['community'])
    
    if style in ['sale', 'shop']:
        all_tags.extend(HASHTAG_SETS['shop'])
    
    if style in ['technical']:
        all_tags.extend(HASHTAG_SETS['glazes'])
    
    selected = random.sample(all_tags, min(15, len(all_tags)))
    hashtags = ' '.join(selected)
    
    # Get best photos for posting
    cursor.execute("""
        SELECT * FROM photos 
        WHERE piece_id = ? 
        ORDER BY is_primary DESC, 
                 CASE angle 
                    WHEN 'front' THEN 1 
                    WHEN 'detail' THEN 2 
                    WHEN 'lifestyle' THEN 3 
                    ELSE 4 
                 END
    """, (piece_id,))
    photos = cursor.fetchall()
    
    print(f"\n📱 Generating {style} post for: {piece['name']}")
    print(f"   Platform: {platform}")
    print("=" * 60)
    
    print("\n📝 CAPTION:")
    print(caption)
    
    print("\n#️⃣ HASHTAGS:")
    print(hashtags)
    
    if photos:
        print("\n📸 SUGGESTED PHOTOS:")
        for ph in photos[:4]:
            primary = " ⭐" if ph['is_primary'] else ""
            print(f"  • {ph['angle'].upper()}: {ph['path']}{primary}")
    
    # Save to database if requested
    if args.save:
        cursor.execute("""
            INSERT INTO social_posts (piece_id, platform, content, hashtags, status, style)
            VALUES (?, ?, ?, ?, 'draft', ?)
        """, (piece_id, platform, caption, hashtags, style))
        conn.commit()
        print(f"\n💾 Saved to social_posts table (ID: {cursor.lastrowid})")
    
    print("\n" + "=" * 60)
    print("✅ Ready to post!")
    
    conn.close()
    return 0

# =============================================================================
# COMMAND: photo - Photo processing
# =============================================================================

def cmd_photo(args):
    """Process and organize photos"""
    piece_id = args.piece_id
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Check piece exists
    cursor.execute("SELECT id, name FROM pieces WHERE id = ?", (piece_id,))
    piece = cursor.fetchone()
    
    if not piece:
        print(f"❌ Piece not found: {piece_id}")
        conn.close()
        return 1
    
    print(f"📸 Photo Processing: {piece['name']}")
    print("-" * 50)
    
    if args.add:
        # Add photos
        if not args.files:
            print("❌ No photo files specified. Use --files")
            conn.close()
            return 1
        
        year = datetime.now().strftime('%Y')
        piece_dir = os.path.join(PHOTO_DIR, year, piece_id)
        Path(piece_dir).mkdir(parents=True, exist_ok=True)
        
        added = 0
        for i, photo_path in enumerate(args.files):
            if not os.path.exists(photo_path):
                print(f"  ⚠️  Not found: {photo_path}")
                continue
            
            ext = os.path.splitext(photo_path)[1].lower()
            if ext not in ['.jpg', '.jpeg', '.png']:
                print(f"  ⚠️  Unsupported format: {photo_path}")
                continue
            
            angle = args.angles[i] if args.angles and i < len(args.angles) else 'other'
            filename = f"{piece_id}-{angle}-{datetime.now().strftime('%Y%m%d%H%M%S')}-{i}{ext}"
            dest_path = os.path.join(piece_dir, filename)
            
            shutil.copy2(photo_path, dest_path)
            
            rel_path = os.path.join(year, piece_id, filename)
            is_primary = 1 if (args.primary and i == 0) else 0
            
            cursor.execute("""
                INSERT INTO photos (piece_id, path, angle, is_primary)
                VALUES (?, ?, ?, ?)
            """, (piece_id, rel_path, angle, is_primary))
            
            print(f"  ✓ Added: {filename} ({angle})")
            added += 1
        
        conn.commit()
        print(f"\n✅ Added {added} photo(s) to {piece_id}")
        print(f"   Location: {piece_dir}")
    
    elif args.list:
        # List photos
        cursor.execute("SELECT * FROM photos WHERE piece_id = ? ORDER BY timestamp", (piece_id,))
        photos = cursor.fetchall()
        
        if not photos:
            print("📭 No photos found")
        else:
            print(f"Photos for {piece_id}:")
            for ph in photos:
                primary = " ⭐" if ph['is_primary'] else ""
                print(f"  {ph['angle']:10} | {ph['path']}{primary}")
    
    elif args.resize:
        # Resize for Instagram (requires PIL)
        try:
            from PIL import Image
        except ImportError:
            print("❌ PIL/Pillow not installed. Cannot resize images.")
            print("   Install with: pip install Pillow")
            conn.close()
            return 1
        
        year = datetime.now().strftime('%Y')
        piece_dir = os.path.join(PHOTO_DIR, year, piece_id)
        
        if not os.path.exists(piece_dir):
            print(f"❌ Photo directory not found: {piece_dir}")
            conn.close()
            return 1
        
        # Get photos
        cursor.execute("SELECT * FROM photos WHERE piece_id = ?", (piece_id,))
        photos = cursor.fetchall()
        
        if not photos:
            print("📭 No photos to resize")
            conn.close()
            return 0
        
        # Instagram sizes
        SIZES = {
            'square': (1080, 1080),      # 1:1 Instagram feed
            'portrait': (1080, 1350),    # 4:5 Instagram portrait
            'landscape': (1080, 566),    # 1.91:1 Instagram landscape
        }
        
        size = SIZES.get(args.size, SIZES['square'])
        output_dir = os.path.join(piece_dir, f"instagram-{args.size}")
        Path(output_dir).mkdir(exist_ok=True)
        
        print(f"🔄 Resizing {len(photos)} photos for Instagram {args.size} ({size[0]}x{size[1]})")
        
        processed = 0
        for ph in photos:
            input_path = os.path.join(PHOTO_DIR, ph['path'])
            if not os.path.exists(input_path):
                continue
            
            filename = os.path.basename(ph['path'])
            name, ext = os.path.splitext(filename)
            output_filename = f"{name}-{args.size}{ext}"
            output_path = os.path.join(output_dir, output_filename)
            
            try:
                with Image.open(input_path) as img:
                    # Convert to RGB if necessary
                    if img.mode in ('RGBA', 'P'):
                        img = img.convert('RGB')
                    
                    # Resize maintaining aspect ratio, then crop/pad to target
                    img.thumbnail((size[0], size[1]), Image.LANCZOS)
                    
                    # Create new image with target size and paste centered
                    new_img = Image.new('RGB', size, (255, 255, 255))
                    x = (size[0] - img.width) // 2
                    y = (size[1] - img.height) // 2
                    new_img.paste(img, (x, y))
                    
                    # Add watermark if requested
                    if args.watermark:
                        from PIL import ImageDraw, ImageFont
                        draw = ImageDraw.Draw(new_img)
                        
                        # Simple text watermark
                        watermark_text = f"{piece['name']} | {datetime.now().year}"
                        try:
                            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
                        except:
                            font = ImageFont.load_default()
                        
                        # Position at bottom right
                        bbox = draw.textbbox((0, 0), watermark_text, font=font)
                        text_width = bbox[2] - bbox[0]
                        text_height = bbox[3] - bbox[1]
                        x = size[0] - text_width - 20
                        y = size[1] - text_height - 20
                        
                        # Draw with outline
                        draw.text((x-1, y), watermark_text, font=font, fill=(0, 0, 0))
                        draw.text((x+1, y), watermark_text, font=font, fill=(0, 0, 0))
                        draw.text((x, y-1), watermark_text, font=font, fill=(0, 0, 0))
                        draw.text((x, y+1), watermark_text, font=font, fill=(0, 0, 0))
                        draw.text((x, y), watermark_text, font=font, fill=(255, 255, 255))
                    
                    new_img.save(output_path, 'JPEG', quality=95, optimize=True)
                    print(f"  ✓ {output_filename}")
                    processed += 1
            except Exception as e:
                print(f"  ⚠️  Error processing {filename}: {e}")
        
        print(f"\n✅ Processed {processed} photos")
        print(f"   Output: {output_dir}")
    
    conn.close()
    return 0

# =============================================================================
# COMMAND: stats - Show statistics
# =============================================================================

def cmd_stats(args):
    """Show inventory and sales statistics"""
    conn = get_db()
    cursor = conn.cursor()
    
    print("\n📊 Ceramics Business Statistics")
    print("=" * 60)
    
    # Count by status
    cursor.execute("SELECT status, COUNT(*), SUM(price), SUM(cost) FROM pieces GROUP BY status")
    rows = cursor.fetchall()
    
    status_data = {row[0]: row for row in rows}
    
    print("\n📦 Inventory by Status:")
    total_pieces = 0
    total_value = 0
    total_cost = 0
    
    for status in STATUSES:
        if status in status_data:
            _, count, value, cost = status_data[status]
            count = count or 0
            value = value or 0
            cost = cost or 0
            profit = value - cost
            print(f"  {status:15} | {count:3} pieces | ${value:>8.2f} value | ${profit:>8.2f} est. profit")
            total_pieces += count
            total_value += value
            total_cost += cost
    
    print(f"  {'TOTAL':15} | {total_pieces:3} pieces | ${total_value:>8.2f} value | ${total_value - total_cost:>8.2f} est. profit")
    
    # Sales summary
    cursor.execute("""
        SELECT COUNT(*), SUM(sale_price), SUM(sale_price - cost) 
        FROM sales s JOIN pieces p ON s.piece_id = p.id
    """)
    sales = cursor.fetchone()
    
    print(f"\n💰 Sales Summary:")
    print(f"  Total sales:     {sales[0] or 0} transactions")
    print(f"  Revenue:         ${sales[1] or 0:,.2f}")
    print(f"  Profit:          ${sales[2] or 0:,.2f}")
    
    # By platform
    cursor.execute("""
        SELECT platform, COUNT(*), SUM(sale_price) 
        FROM sales GROUP BY platform
    """)
    platforms = cursor.fetchall()
    
    if platforms:
        print(f"\n📈 By Platform:")
        for p in platforms:
            print(f"  {p[0]:15} | {p[1]:3} sales | ${p[2] or 0:,.2f}")
    
    # Photos count
    cursor.execute("SELECT COUNT(*), SUM(is_primary) FROM photos")
    photos = cursor.fetchone()
    print(f"\n📸 Photos: {photos[0]} total, {photos[1] or 0} primary")
    
    # Social posts
    cursor.execute("SELECT status, COUNT(*) FROM social_posts GROUP BY status")
    post_counts = cursor.fetchall()
    if post_counts:
        print(f"\n📱 Social Posts:")
        for status, count in post_counts:
            print(f"  {status}: {count}")
    
    # Series breakdown
    cursor.execute("SELECT series, COUNT(*), SUM(price) FROM pieces WHERE series IS NOT NULL GROUP BY series")
    series_data = cursor.fetchall()
    if series_data:
        print(f"\n🎨 By Series:")
        for series, count, value in series_data:
            print(f"  {series or 'Uncategorized'}: {count} pieces, ${value or 0:.2f}")
    
    conn.close()
    return 0

# =============================================================================
# COMMAND: sale - Record a sale
# =============================================================================

def cmd_sale(args):
    """Record a sale"""
    piece_id = args.piece_id
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Check piece exists
    cursor.execute("SELECT * FROM pieces WHERE id = ?", (piece_id,))
    piece = cursor.fetchone()
    
    if not piece:
        print(f"❌ Piece not found: {piece_id}")
        conn.close()
        return 1
    
    print(f"💰 Record Sale: {piece['name']}")
    print("-" * 50)
    
    # Get sale details
    if args.price:
        sale_price = args.price
    else:
        price_input = input(f"Sale price [{piece['price']}]: ").strip()
        sale_price = float(price_input) if price_input else piece['price']
    
    if args.platform:
        platform = args.platform
    else:
        print(f"Platforms: {', '.join(PLATFORMS)}")
        platform = input("Platform: ").strip()
    
    if platform not in PLATFORMS:
        print(f"❌ Invalid platform")
        conn.close()
        return 1
    
    buyer_name = input("Buyer name: ").strip() or None
    buyer_email = input("Buyer email: ").strip() or None
    notes = input("Notes: ").strip() or None
    
    try:
        cursor.execute("""
            INSERT INTO sales (piece_id, sale_price, platform, buyer_name, buyer_email, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (piece_id, sale_price, platform, buyer_name, buyer_email, notes))
        
        # Update piece status to sold
        cursor.execute("""
            UPDATE pieces SET status = 'sold', sold_date = ? WHERE id = ?
        """, (datetime.now().isoformat(), piece_id))
        
        conn.commit()
        
        print(f"\n✅ Sale recorded: ${sale_price:.2f} via {platform}")
        print(f"   Piece status: sold")
    except Exception as e:
        print(f"❌ Error recording sale: {e}")
        conn.rollback()
        return 1
    finally:
        conn.close()
    
    return 0

# =============================================================================
# COMMAND: search - Search pieces
# =============================================================================

def cmd_search(args):
    """Search pieces by term"""
    term = args.term.lower()
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM pieces 
        WHERE LOWER(name) LIKE ? 
           OR LOWER(glaze) LIKE ? 
           OR LOWER(series) LIKE ?
           OR LOWER(notes) LIKE ?
           OR LOWER(materials) LIKE ?
           OR LOWER(dimensions) LIKE ?
        ORDER BY created_date DESC
    """, tuple([f"%{term}%"] * 6))
    
    rows = cursor.fetchall()
    
    if not rows:
        print(f"🔍 No results for '{term}'")
        conn.close()
        return 0
    
    print(f"🔍 Search: '{term}' ({len(rows)} results)")
    print("=" * 80)
    
    for row in rows:
        print(format_piece(row))
    
    conn.close()
    return 0

# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Ceramics Business Intelligence CLI - Phase 1",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  ceramics add                                    # Add new piece interactively
  ceramics add --photos photo1.jpg photo2.jpg     # Add with photos
  ceramics list                                   # Show all pieces
  ceramics list --status listed                   # Show listed pieces only
  ceramics show piece-id-123                      # Show piece details
  ceramics update piece-id-123 --status sold      # Update status
  ceramics post piece-id-123 --style storytelling # Generate social post
  ceramics photo piece-id-123 --add --files *.jpg # Add photos
  ceramics photo piece-id-123 --resize --size square --watermark  # Resize for Instagram
  ceramics sale piece-id-123 --price 150 --platform etsy  # Record sale
  ceramics stats                                  # Show business statistics
  ceramics search blue                            # Search for 'blue'

Status Workflow:
  in-progress → ready-for-sale → listed → sold → archived
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # Add command
    add_parser = subparsers.add_parser('add', help='Add new piece')
    add_parser.add_argument('--photos', nargs='+', help='Photo files to add')
    add_parser.add_argument('--angles', nargs='+', help='Angles for each photo')
    
    # List command
    list_parser = subparsers.add_parser('list', help='List inventory')
    list_parser.add_argument('--status', choices=STATUSES, help='Filter by status')
    list_parser.add_argument('--series', help='Filter by series')
    list_parser.add_argument('--glaze', help='Filter by glaze')
    list_parser.add_argument('--type', choices=TYPES, help='Filter by type')
    list_parser.add_argument('--min-price', type=float, help='Minimum price')
    list_parser.add_argument('--max-price', type=float, help='Maximum price')
    list_parser.add_argument('--limit', type=int, help='Limit results')
    
    # Show command
    show_parser = subparsers.add_parser('show', help='Show piece details')
    show_parser.add_argument('id', help='Piece ID')
    
    # Update command
    update_parser = subparsers.add_parser('update', help='Update piece')
    update_parser.add_argument('id', help='Piece ID')
    update_parser.add_argument('--status', choices=STATUSES, help='New status')
    update_parser.add_argument('--name', help='New name')
    update_parser.add_argument('--glaze', help='New glaze')
    update_parser.add_argument('--price', type=float, help='New price')
    update_parser.add_argument('--cost', type=float, help='New cost')
    update_parser.add_argument('--series', help='New series')
    update_parser.add_argument('--dimensions', help='New dimensions')
    update_parser.add_argument('--notes', help='New notes')
    
    # Post command
    post_parser = subparsers.add_parser('post', help='Generate social post')
    post_parser.add_argument('id', help='Piece ID')
    post_parser.add_argument('--style', choices=['aesthetic', 'casual', 'storytelling', 'technical', 'sale'], 
                            help='Caption style')
    post_parser.add_argument('--platform', choices=['instagram', 'tiktok', 'facebook', 'pinterest', 'website'], 
                            help='Target platform')
    post_parser.add_argument('--save', action='store_true', help='Save to database')
    
    # Photo command
    photo_parser = subparsers.add_parser('photo', help='Photo operations')
    photo_parser.add_argument('piece_id', help='Piece ID')
    photo_parser.add_argument('--add', action='store_true', help='Add photos')
    photo_parser.add_argument('--files', nargs='+', help='Photo files')
    photo_parser.add_argument('--angles', nargs='+', help='Photo angles')
    photo_parser.add_argument('--primary', action='store_true', help='First photo is primary')
    photo_parser.add_argument('--list', action='store_true', help='List photos')
    photo_parser.add_argument('--resize', action='store_true', help='Resize for Instagram')
    photo_parser.add_argument('--size', choices=['square', 'portrait', 'landscape'], 
                             default='square', help='Instagram size')
    photo_parser.add_argument('--watermark', action='store_true', help='Add watermark')
    
    # Sale command
    sale_parser = subparsers.add_parser('sale', help='Record a sale')
    sale_parser.add_argument('piece_id', help='Piece ID')
    sale_parser.add_argument('--price', type=float, help='Sale price')
    sale_parser.add_argument('--platform', choices=PLATFORMS, help='Sales platform')
    
    # Stats command
    subparsers.add_parser('stats', help='Show statistics')
    
    # Search command
    search_parser = subparsers.add_parser('search', help='Search pieces')
    search_parser.add_argument('term', help='Search term')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # Route to command handler
    commands = {
        'add': cmd_add,
        'list': cmd_list,
        'show': cmd_show,
        'update': cmd_update,
        'post': cmd_post,
        'photo': cmd_photo,
        'sale': cmd_sale,
        'stats': cmd_stats,
        'search': cmd_search,
    }
    
    return commands[args.command](args)

if __name__ == '__main__':
    sys.exit(main())
