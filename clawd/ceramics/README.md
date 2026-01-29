# Ceramics Business Intelligence System
## Phase 1: Foundation

Complete inventory management, photo processing, and social media content generation system for ceramics business.

---

## Quick Start

```bash
cd ~/clawd/ceramics

# Add a new piece
./ceramics.py add

# View all pieces
./ceramics.py list

# Generate Instagram post
./ceramics.py post piece-id-123 --style storytelling

# Process photos for Instagram
./ceramics-photo.py resize piece-id-123 --size instagram-square --watermark

# Record a sale
./ceramics.py sale piece-id-123 --price 150 --platform etsy

# View statistics
./ceramics.py stats
```

---

## Database Schema

### Tables

#### pieces
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | Unique piece identifier |
| name | TEXT | Piece name |
| type | TEXT | Type (vase, bowl, plate, mug, sculpture, planter, other) |
| dimensions | TEXT | Dimensions (e.g., "8x12x6 in") |
| glaze | TEXT | Glaze name |
| price | REAL | Sale price in USD |
| cost | REAL | Production cost |
| status | TEXT | Status (see workflow below) |
| series | TEXT | Series name (e.g., "Layered Blue") |
| created_date | TEXT | Creation timestamp |
| completed_date | TEXT | When marked ready-for-sale |
| listed_date | TEXT | When marked listed |
| sold_date | TEXT | When marked sold |
| notes | TEXT | Notes |
| materials | TEXT | Materials used (e.g., "Stoneware, cone 6") |
| firing_type | TEXT | Firing type (bisque, glaze, raku, wood, gas, electric) |

#### photos
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Photo ID |
| piece_id | TEXT | Foreign key to pieces |
| path | TEXT | Relative path to photo file |
| angle | TEXT | Photo angle (front, side, detail, studio, lifestyle, back, top, bottom, other) |
| is_primary | INTEGER | 1 if primary photo, 0 otherwise |
| timestamp | TEXT | When added |
| width | INTEGER | Image width |
| height | INTEGER | Image height |
| notes | TEXT | Notes |

#### social_posts
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Post ID |
| piece_id | TEXT | Foreign key to pieces (nullable) |
| platform | TEXT | Platform (instagram, tiktok, facebook, pinterest, website, newsletter) |
| post_date | TEXT | When posted |
| content | TEXT | Caption content |
| hashtags | TEXT | Hashtags |
| status | TEXT | Status (draft, scheduled, posted, archived) |
| style | TEXT | Style (aesthetic, casual, storytelling, technical, sale, process, collection) |
| likes | INTEGER | Like count |
| comments | INTEGER | Comment count |
| saves | INTEGER | Save count |
| shares | INTEGER | Share count |
| views | INTEGER | View count |
| scheduled_for | TEXT | Scheduled post time |
| notes | TEXT | Notes |

#### sales
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Sale ID |
| piece_id | TEXT | Foreign key to pieces |
| sale_date | TEXT | Sale timestamp |
| sale_price | REAL | Sale price |
| platform | TEXT | Sales platform |
| buyer_name | TEXT | Buyer name |
| buyer_email | TEXT | Buyer email |
| buyer_phone | TEXT | Buyer phone |
| shipping_address | TEXT | Shipping address |
| tracking_number | TEXT | Tracking number |
| shipped_date | TEXT | When shipped |
| payment_status | TEXT | Payment status |
| notes | TEXT | Notes |

#### opportunities
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Opportunity ID |
| type | TEXT | Type (gallery, show, fair, wholesale, custom-order, collaboration, commission, other) |
| title | TEXT | Title |
| organization | TEXT | Organization name |
| status | TEXT | Status (lead, contacted, interested, negotiating, confirmed, in-progress, completed, declined, archived) |
| estimated_revenue | REAL | Estimated revenue |
| actual_revenue | REAL | Actual revenue |
| deadline | TEXT | Application/deadline date |
| start_date | TEXT | Start/exhibition date |
| notes | TEXT | Notes |

---

## Status Workflow

The system enforces a defined status workflow for pieces:

```
in-progress → ready-for-sale → listed → sold → archived
                              ↓
                            gifted
```

### Status Definitions
| Status | Icon | Meaning |
|--------|------|---------|
| 🔨 in-progress | 🔨 | Currently working on it |
| ✨ ready-for-sale | ✨ | Finished, ready to sell |
| 🏷️ listed | 🏷️ | Listed on sales platforms |
| 💰 sold | 💰 | Sold |
| 📦 archived | 📦 | Archived (not for sale) |
| 🎁 gifted | 🎁 | Given away as gift |

### Allowed Transitions
- **in-progress**: → ready-for-sale, archived
- **ready-for-sale**: → listed, archived, in-progress
- **listed**: → sold, archived, ready-for-sale
- **sold**: → archived
- **archived**: → in-progress, ready-for-sale

---

## CLI Commands

### ceramics.py - Main CLI

#### add
Add a new piece interactively with optional photos.
```bash
./ceramics.py add
./ceramics.py add --photos photo1.jpg photo2.jpg --angles front side
```

#### list
View inventory with filters.
```bash
./ceramics.py list                              # All pieces
./ceramics.py list --status listed             # Listed only
./ceramics.py list --type bowl                 # Bowls only
./ceramics.py list --series "Winter Collection" # By series
./ceramics.py list --min-price 50 --max-price 200
```

#### show
Show detailed information about a piece.
```bash
./ceramics.py show piece-id-123
```

#### update
Update piece metadata or status.
```bash
./ceramics.py update piece-id-123 --status listed
./ceramics.py update piece-id-123 --price 150 --glaze "Blue Celadon"
```

#### post
Generate social media content for a piece.
```bash
./ceramics.py post piece-id-123
./ceramics.py post piece-id-123 --style storytelling
./ceramics.py post piece-id-123 --style sale --platform instagram --save
```

#### photo
Photo operations (wrapper for ceramics-photo.py).
```bash
./ceramics.py photo piece-id-123 --add --files *.jpg
./ceramics.py photo piece-id-123 --list
./ceramics.py photo piece-id-123 --resize --size instagram-square --watermark
```

#### sale
Record a sale for a piece.
```bash
./ceramics.py sale piece-id-123
./ceramics.py sale piece-id-123 --price 150 --platform etsy
```

#### stats
Show business statistics.
```bash
./ceramics.py stats
```

#### search
Search pieces by term.
```bash
./ceramics.py search blue
./ceramics.py search "celadon glaze"
```

### ceramics-photo.py - Photo Processing

#### add
Add photos for a piece.
```bash
./ceramics-photo.py add piece-123 photo1.jpg photo2.jpg --angle front
./ceramics-photo.py add piece-123 *.jpg --watermark
```

#### batch
Batch process a directory of photos.
```bash
./ceramics-photo.py batch piece-123 ./raw-photos/ --size instagram-square
```

#### resize
Resize existing photos for Instagram.
```bash
./ceramics-photo.py resize piece-123 --size instagram-square
./ceramics-photo.py resize piece-123 --size instagram-portrait --watermark
./ceramics-photo.py resize piece-123 --size instagram-landscape --quality 95
```

#### watermark
Add watermark to existing photos.
```bash
./ceramics-photo.py watermark piece-123
./ceramics-photo.py watermark piece-123 --text "Artist Name 2026"
```

#### list
List photos for a piece.
```bash
./ceramics-photo.py list piece-123
```

#### info
Show photo system information.
```bash
./ceramics-photo.py info
```

---

## Photo Processing

### Instagram Sizes

| Size | Dimensions | Use Case |
|------|------------|----------|
| instagram-square | 1080x1080 | 1:1 Feed posts |
| instagram-portrait | 1080x1350 | 4:5 Portrait posts |
| instagram-landscape | 1080x566 | 1.91:1 Landscape posts |
| instagram-story | 1080x1920 | 9:16 Stories/Reels |

### Other Sizes

| Size | Dimensions | Use Case |
|------|------------|----------|
| web | 1200x1200 | Website gallery |
| social | 1080x1080 | Social media |
| thumbnail | 300x300 | Thumbnails |
| etsy | 2000x2000 | Etsy listing |

### Watermark Format

Default watermark: `Piece Name | Year`

Custom watermark: Specified with `--text`

Watermark appears in bottom right corner with subtle shadow for visibility.

---

## Directory Structure

```
~/clawd/ceramics/
├── ceramics.sqlite          # Database
├── ceramics.py              # Main CLI
├── ceramics-photo.py        # Photo processor
├── schema.sql               # Database schema
├── photos/                  # Photo storage
│   ├── 2025/
│   │   └── piece-id-123/
│   │       ├── piece-id-123-front-20260101120000.jpg
│   │       ├── piece-id-123-detail-20260101120001.jpg
│   │       └── instagram-square/
│   │           └── piece-id-123-front-20260101120000-square.jpg
│   ├── 2026/
│   └── 2027/
├── backups/                 # Database backups
└── reports/                 # Generated reports
```

---

## Caption Styles

### aesthetic
- "Piece Name — Glaze on Materials"
- "The way the Glaze catches light on this Type..."
- "Quiet moments with Glaze and clay."

### casual
- "Fresh out of the kiln! This Type came out better than expected 🎉"
- "Experimenting with Glaze on this Type and I'm loving how it turned out!"

### storytelling
- "This Type started as an experiment with Glaze. Three firings later, it's exactly what I imagined."
- "The journey of this piece: wedging clay at midnight, glazing at dawn..."

### technical
- "Glaze over Materials. Fired to cone 6. Dimensions."
- "Exploring the interaction between Glaze and this clay body."

### sale
- "Now available! Name — Dimensions of Glaze goodness. DM to purchase ✨"
- "This Type is looking for a home. Glaze, Dimensions, ready to ship."

---

## Installation

### Dependencies

- Python 3.8+
- SQLite3 (included in Python)
- Pillow (optional, for photo processing)

```bash
# Install Pillow (optional, for Instagram photo processing)
pip install Pillow
```

### Database Initialization

Database is automatically initialized on first use. To reinitialize:

```bash
python3 init_db.py
```

---

## Example Usage Session

```bash
# 1. Add a new piece
$ ./ceramics.py add
Piece name: Ocean Breeze Vase
Types: vase, bowl, plate, mug, sculpture, planter, other
Type: vase
Dimensions (e.g., '8x12x6 in'): 8x6x6 in
Glaze name: Celadon Blue
Price (USD): 120
Production cost (USD): 45
Series name (optional): Winter Collection
✅ Piece added: ocean-breeze-vase-20260129083030
   Status: in-progress
   Photo directory: /home/liam/clawd/ceramics/photos/2026/ocean-breeze-vase-20260129083030

# 2. Add photos (from a different directory)
$ ./ceramics-photo.py batch ocean-breeze-vase-20260129083030 ~/Desktop/vase-photos/ --angle front
📁 Found 3 images in: ~/Desktop/vase-photos/
  ✓ Added: ocean-breeze-vase-20260129083030-front-20260129083130.jpg (front)
  ✓ Added: ocean-breeze-vase-20260129083030-detail-20260129083130-1.jpg (detail)
  ✓ Added: ocean-breeze-vase-20260129083030-other-20260129083130-2.jpg (other)
✅ Added 3 photos

# 3. Process for Instagram
$ ./ceramics-photo.py resize ocean-breeze-vase-20260129083030 --size instagram-square --watermark
🔄 Resizing 3 photos for instagram-square (1080x1080)
  ✓ ocean-breeze-vase-20260129083030-front-20260129083130-square.jpg
  ✓ ocean-breeze-vase-20260129083030-detail-20260129083130-1-square.jpg
  ✓ ocean-breeze-vase-20260129083030-other-20260129083130-2-square.jpg
✅ Processed 3 photos
   Output: /home/liam/clawd/ceramics/photos/2026/ocean-breeze-vase-20260129083030/instagram-square/

# 4. Generate social post
$ ./ceramics.py post ocean-breeze-vase-20260129083030 --style aesthetic --save
📱 Generating aesthetic post for: Ocean Breeze Vase
   Platform: instagram
============================================================
📝 CAPTION:
Ocean Breeze Vase — Celadon Blue on stoneware

#️⃣ HASHTAGS:
#ceramics #handbuilt #pottersofinstagram #makersgonnamake #potter #clay
#ceramicstudio #ceramicart #potterylife #pottery #handmade #ceramicglaze
#glazecombo #claycommunity #studiopottery

📸 SUGGESTED PHOTOS:
  • FRONT: 2026/ocean-breeze-vase-20260129083030/ocean-breeze-vase-20260129083030-front-20260129083130.jpg ⭐
  • DETAIL: 2026/ocean-breeze-vase-20260129083030/ocean-breeze-vase-20260129083030-detail-20260129083130-1.jpg
  • OTHER: 2026/ocean-breeze-vase-20260129083030/ocean-breeze-vase-20260129083030-other-20260129083130-2.jpg

💾 Saved to social_posts table (ID: 42)

============================================================
✅ Ready to post!

# 5. Update status when ready to sell
$ ./ceramics.py update ocean-breeze-vase-20260129083030 --status ready-for-sale
✅ Updated 1 field(s)
   Status: in-progress → ready-for-sale

# 6. List all ready-for-sale pieces
$ ./ceramics.py list --status ready-for-sale
📦 Inventory (1 shown, 1 total)
================================================================================
✨ ocean-breeze-vase-20260129083030 | Ocean Breeze Vase (vase) | Celadon Blue | $120.00 | ready-for-sale
================================================================================
Status breakdown:
  ✨ ready-for-sale: 1
  🔨 in-progress: 0

# 7. Mark as listed on Etsy
$ ./ceramics.py update ocean-breeze-vase-20260129083030 --status listed
✅ Updated 1 field(s)
   Status: ready-for-sale → listed

# 8. Record the sale
$ ./ceramics.py sale ocean-breeze-vase-20260129083030 --price 120 --platform etsy
💰 Record Sale: Ocean Breeze Vase
--------------------------------------------------
✅ Sale recorded: $120.00 via etsy
   Piece status: sold

# 9. View statistics
$ ./ceramics.py stats

📊 Ceramics Business Statistics
============================================================

📦 Inventory by Status:
  💰 sold             |   1 pieces | $  120.00 value | $   75.00 est. profit
  TOTAL              |   1 pieces | $  120.00 value | $   75.00 est. profit

💰 Sales Summary:
  Total sales:     1 transactions
  Revenue:         $120.00
  Profit:          $75.00

📈 By Platform:
  etsy              |   1 sales | $120.00

📸 Photos: 3 total, 1 primary

📱 Social Posts:
  draft: 1
```

---

## Testing Checklist

### Database
- [x] SQLite database at ~/clawd/ceramics/ceramics.sqlite
- [x] pieces table with all fields
- [x] photos table with foreign key to pieces
- [x] social_posts table with foreign key to pieces
- [x] sales table with foreign key to pieces
- [x] opportunities table for tracking shows/galleries
- [x] Indexes for performance
- [x] Views for common queries
- [x] Triggers for data integrity

### CLI
- [x] ceramics.py with all commands
- [x] add: Interactive prompt to add new piece
- [x] list: View inventory with filters (--status, --type, --series)
- [x] show: Display piece details with photos, sales, posts
- [x] update: Update piece status or metadata
- [x] post: Generate social media content
- [x] photo: Photo operations wrapper
- [x] sale: Record sales
- [x] stats: Business statistics
- [x] search: Search pieces

### Photo Processing
- [x] Directory structure ~/clawd/ceramics/[year]/[piece-id]/
- [x] Resizes images for Instagram (1080x1080, 1080x1350, 1080x566)
- [x] Metadata watermark (piece name | year)
- [x] Organizes by piece
- [x] ceramics-photo.py standalone script
- [x] Batch processing
- [x] Database integration

### Status Workflow
- [x] Defined: in-progress → ready-for-sale → listed → sold → archived
- [x] Status transition validation
- [x] Date tracking (created, completed, listed, sold)
- [x] Visual status icons

---

## What's Ready for Simon to Test

### Core Inventory Management ✓
1. **Add pieces** - `./ceramics.py add`
2. **List inventory** - `./ceramics.py list` (with filters)
3. **Update pieces** - `./ceramics.py update`
4. **View details** - `./ceramics.py show`
5. **Search** - `./ceramics.py search`

### Photo Management ✓
1. **Add photos** - `./ceramics-photo.py add` or `./ceramics.py photo --add`
2. **Batch process** - `./ceramics-photo.py batch`
3. **List photos** - `./ceramics-photo.py list`
4. **Resize for Instagram** - `./ceramics-photo.py resize --size instagram-*`
5. **Add watermarks** - `./ceramics-photo.py watermark`

### Social Media ✓
1. **Generate posts** - `./ceramics.py post --style [aesthetic|casual|storytelling|technical|sale]`
2. **Save posts to database** - `./ceramics.py post --save`
3. **Suggested photos** - Auto-suggests best photos for posting

### Sales Tracking ✓
1. **Record sales** - `./ceramics.py sale`
2. **Auto-updates status** - Changes piece to 'sold'
3. **View statistics** - `./ceramics.py stats`

### Status Workflow ✓
1. **Defined workflow** - in-progress → ready-for-sale → listed → sold → archived
2. **Transition validation** - Prevents invalid status changes
3. **Date tracking** - Automatically updates completed_date, listed_date, sold_date

---

## Next Steps for Phase 2 (Future)

- Web dashboard with visual inventory browser
- Automated Instagram posting via API
- Price tracking and market analysis
- Inventory forecasting
- Material cost tracking and profit analysis
- Bulk import/export
- Integration with Etsy/Shopify APIs
- Mobile companion app
- Photo gallery with lightbox viewer

---

## Support

For issues or feature requests, add to EVOLUTION-QUEUE.md in ~/clawd/

---

*Ceramics Business Intelligence System v1.0*
*Built with Python, SQLite, and love for clay*
