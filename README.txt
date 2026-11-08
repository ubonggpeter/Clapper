YOUR BLOG, AS A STATIC SITE
===========================
Blog: Welcome Desk
Address: https://ubonggpeter.github.io/Clapper/
Country: Nigeria (en-NG)
Made: 2026-11-08 01:55

HOW TO PUT IT ONLINE
UNZIP FIRST, then upload EVERYTHING: index.html, every .css and .js file (they sit right next to index.html) and the uploads folder (your pictures, sounds and videos). If a file is missing the page looks broken or slow. The page shows a red notice when it notices that.

GITHUB PAGES: open your repository > Add file > Upload files, and drag in ALL the files and the uploads folder from a computer. A phone cannot upload folders, and GitHub takes at most 100 files at a time, so upload in batches (or use GitHub Desktop). Then Settings > Pages > deploy from the main branch, root folder.
NETLIFY / CLOUDFLARE PAGES: drag the whole unzipped folder (Netlify Drop accepts the ZIP too).

1. Upload everything in this folder to the root of https://ubonggpeter.github.io/ (GitHub Pages, Netlify, Cloudflare Pages, Vercel static, or any hosting).
2. Make sure these open in a browser: https://ubonggpeter.github.io/  https://ubonggpeter.github.io/robots.txt  https://ubonggpeter.github.io/sitemap.xml
3. Google Search Console: add the domain, submit sitemap.xml, then use URL Inspection > Request indexing.
4. Bing Webmaster Tools: import from Search Console.

WHAT STILL WORKS WITHOUT A SERVER
- Posts appearing one by one (your posting delay), the typing indicator and the new-post pop-up
- Reaction emojis and their sounds, your custom emoji sounds, away sound, background sound
- Animations, icons, social links, Add as App (install), share button
- The intake form: it sends the details straight to your Google script links
- Premium posts show a locked card; the Unlock button goes to: https://betsintel.com

WHAT NEEDS THE MAIN SITE (so it is switched off here)
Comments, points and rewards, Ask AI, polls results, live message tools, push notifications.
Reaction numbers start from the numbers on the day you downloaded and then count on each visitor's own device.

NOTE: your Google script links are inside tf-config.js because the form must reach them from the visitor's browser.
