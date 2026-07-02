# maleFOOTfantasy

Adult content gallery platform. Curated AI-generated and real foot-focused content for men.

## Live URLs
- **Gallery:** https://malefootfantasy.com
- **Admin Panel:** https://malefootfantasy.com/admin-panel.html

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS (no framework)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (bucket: `media`)
- **Email notifications:** EmailJS
- **Hosting:** GitHub Pages
- **Domain:** malefootfantasy.com via Network Solutions DNS

## File Structure
```
/
├── index.html          # Gallery site (public-facing)
├── admin-panel.html    # Admin moderation panel (private)
├── schema.sql          # Supabase database schema
├── css/
│   ├── main.css        # Shared/gallery styles
│   └── admin.css       # Admin panel styles
├── js/
│   ├── config.js       # Supabase + EmailJS credentials
│   ├── gallery.js      # Gallery logic (loading, filtering, likes, modal)
│   ├── submit.js       # User submission + custom order forms
│   └── admin.js        # Admin panel logic (moderation, CRUD)
└── README.md
```

## Database Tables (Supabase)
- **posts** — published gallery items (title, type, tags, likes, archived, storage_path)
- **submissions** — user-submitted content pending review (status: pending/approved/rejected, archived)
- **orders** — custom generation orders (package, price, request, status: new/progress/delivered/refunded, archived)

## Key Features
- Age verification gate (sessionStorage)
- Masonry gallery with tag filtering, search, sort (recent/popular/A-Z)
- Image and video support (videos autoplay muted on hover)
- Like system (persisted to Supabase + localStorage for session memory)
- User submit form → saves to submissions table → email notification to admin
- Custom order form → saves to orders table → email notification to admin
- Admin panel with login (Supabase Auth)
- Review modal: see full image/video before approving/rejecting
- Approve submission → auto-creates post in gallery
- Archive system (soft delete, reversible) on posts/submissions/orders
- Direct post upload from admin (New Post page)
- Ad strip at bottom (dismissible)

## Credentials & Services
- **Supabase project:** vgmpkiyxblstqeyucfoq (MaleFootFantasy)
- **EmailJS service:** service_mjvoscf
- **EmailJS template:** template_ea513ci
- All credentials are in `js/config.js`

## Deployment
Push to `main` branch → GitHub Pages auto-deploys.
No build step needed — plain HTML/CSS/JS.

## Common Tasks
- **Add a tag:** Admin panel → Tags page
- **Publish a post:** Admin panel → New Post, or approve a submission
- **Check orders:** Admin panel → Custom Orders
- **Update styles:** Edit `css/main.css` or `css/admin.css`
- **Update gallery logic:** Edit `js/gallery.js`
- **Update admin logic:** Edit `js/admin.js`
