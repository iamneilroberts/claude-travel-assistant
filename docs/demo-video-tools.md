# Demo Video Production Tools & Workflow

Ubuntu-focused guide for recording and editing Voygent demo videos.

## Prerequisites

- Ubuntu 22.04+ (or compatible distro)
- 1920x1080 display resolution
- ~5GB free disk space for video files

---

## Recording: SimpleScreenRecorder (Recommended)

### Installation

```bash
sudo apt install simplescreenrecorder
```

### Configuration

1. Launch SimpleScreenRecorder
2. **Input settings:**
   - Record the entire screen (or define a rectangle for cleaner framing)
   - Frame rate: 30 fps
   - Record cursor: Yes (helps viewers follow along)

3. **Output settings:**
   - Container: MP4
   - Codec: H.264
   - Preset: Fast
   - CRF: 20 (good quality, reasonable file size)
   - Audio: AAC, 128 kbps (or disable if adding music later)

4. **Hotkey:**
   - Set a hotkey for Start/Stop (e.g., `Ctrl+R`)
   - Or use the system tray icon

### Recording Tips

- **Record scenes separately** - easier to re-record if needed
- **Move mouse deliberately** - viewers need to track your cursor
- **Pause before clicking** - gives viewers time to see what you're about to do
- **Leave 2-3 seconds of stillness** at start/end of each clip
- **If you mess up, just re-record** - editing is easier than fixing bad takes

### Output Location

Files save to `~/Videos/` by default. Change in Preferences if needed.

---

## Alternative: GNOME Built-in Recorder

Simplest option if you just need quick captures:

1. Press `Print Screen` key (or `PrtSc`)
2. Click the video camera icon (Screen Recording tab)
3. Select area or full screen
4. Click the red button to start/stop
5. Files save to `~/Videos/` as .webm

**Limitations:** Less control over quality, no audio recording, webm format needs conversion.

---

## Alternative: OBS Studio

For more complex recordings (scene switching, overlays):

```bash
sudo apt install obs-studio
```

More setup required but offers:
- Scene composition
- Multiple sources
- Live preview
- Streaming capability

Usually overkill for demo videos.

---

## Editing: Shotcut (Recommended)

### Installation

```bash
# Via Snap (recommended - stays updated)
sudo snap install shotcut --classic

# Or via Flatpak
flatpak install org.shotcut.Shotcut

# Or via apt (may be older version)
sudo apt install shotcut
```

### Quick Start Workflow

1. **Import clips:**
   - File → Open → select all your recordings
   - Clips appear in the Playlist panel

2. **Build timeline:**
   - Drag clips from Playlist to Timeline (bottom panel)
   - Arrange in sequence

3. **Trim clips:**
   - Click clip in timeline
   - Drag the edges to trim start/end
   - Or position playhead and press `S` to split

4. **Add captions:**
   - Select clip in timeline
   - Filters tab → click `+` → Text: Simple
   - Type your caption text
   - Adjust position, size, timing

5. **Add music:**
   - Add an audio track (Timeline menu → Add Audio Track)
   - Drag audio file to the new track
   - Adjust volume: Filters → Gain/Volume

6. **Export:**
   - Export tab
   - Preset: YouTube (or "H.264 High Profile")
   - Click Export File
   - Wait for render to complete

### Caption Styling for Maximum Readability

Since there's no voiceover, captions ARE your narrative. Make them count:

**Recommended settings in Shotcut:**

1. **Font:**
   - Sans-serif (Liberation Sans, Ubuntu, or Roboto)
   - Bold weight

2. **Size:**
   - 8-10% of video height
   - On 1080p, that's roughly 86-108px

3. **Color scheme (choose one):**
   - White text + black outline (most versatile)
   - Yellow text + black outline (high visibility)
   - White text + semi-transparent black background

4. **Position:**
   - Bottom of frame, centered
   - Leave ~10% margin from bottom edge

5. **Outline settings:**
   - Enable outline
   - Outline color: Black
   - Outline width: 2-4px

**Caption content guidelines:**
- One key point per screen (5-8 words max)
- Action words: "Watch this", "One command", "Instant preview"
- Let visuals speak, captions highlight

### Splitting Clips for Different Captions

1. Position playhead where you want caption to change
2. Press `S` to split the clip
3. Select each segment individually
4. Add different Text: Simple filter to each

### Speed Adjustments

To speed up boring parts (typing, loading):

1. Select clip in timeline
2. Properties tab
3. Speed: 1.5x or 2.0x

Keep narration-worthy moments at 1.0x.

### Useful Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `J/K/L` | Rewind/Pause/Forward |
| `I/O` | Set in/out points |
| `S` | Split at playhead |
| `X` | Ripple delete selected |
| `Ctrl+Z` | Undo |
| `Ctrl+S` | Save project |

---

## Alternative Editor: Kdenlive

More powerful, slightly steeper learning curve:

```bash
sudo apt install kdenlive
```

Similar workflow to Shotcut but with:
- More effects and transitions
- Keyframe animation
- Multi-track audio mixing
- Better titling system

Use if Shotcut feels limiting.

---

## Music: YouTube Audio Library

**URL:** https://studio.youtube.com/channel/UC/music

(You'll need to access via YouTube Studio)

### How to Access

1. Go to [studio.youtube.com](https://studio.youtube.com)
2. Create/select your channel
3. Left sidebar → Audio Library
4. Browse or filter by:
   - Genre
   - Mood (Bright, Calm, Dramatic, Funky, etc.)
   - Duration
   - Attribution requirements

### Recommended Search Filters

**For Travel Agent demo (upbeat, modern):**
- Mood: Bright, Inspirational
- Genre: Pop, Corporate
- Duration: 3-5 minutes

**For Tech demo (ambient, techy):**
- Mood: Calm, Dark, Funky
- Genre: Electronic, Ambient
- Duration: 3-5 minutes

### Attribution

Most tracks are free with no attribution required. Check the license column:
- ✓ = No attribution needed
- Person icon = Attribution required (add to video description)

### Download

Click the download arrow next to any track. MP3 format.

---

## YouTube Setup: Brand Account

Create a separate channel for Voygent (not your personal account):

### One-Time Setup

1. Go to [youtube.com](https://youtube.com)
2. Click your profile icon → Switch account → Add account (if needed)
3. Go to [studio.youtube.com](https://studio.youtube.com)
4. Click profile icon → Create a channel
5. Choose **"Use a custom name"**
6. Enter: "Voygent" or "SoMo Travel"
7. Click Create

This creates a Brand Account that:
- Is completely separate from your personal YouTube
- Shows "Voygent" as the channel name in embeds
- Can have team members added as managers later
- Has separate analytics

### Uploading Videos

1. YouTube Studio → Create → Upload videos
2. Select your exported video file
3. Fill in details:
   - Title: "Voygent Demo: Plan Trips Like You Text a Friend"
   - Description: Brief overview, link to voygent.ai
   - Thumbnail: Upload custom (see Thumbnail section)
4. **Visibility: Start with "Unlisted"**
   - Review the video, check everything looks right
   - Change to "Public" when ready

### Embedding on voygent.ai

After upload, get embed code:

1. Go to the video page
2. Click Share → Embed
3. Copy the iframe code

```html
<iframe
  width="560"
  height="315"
  src="https://www.youtube.com/embed/VIDEO_ID"
  title="Voygent Demo"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen>
</iframe>
```

Responsive wrapper:
```html
<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
  <iframe
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    src="https://www.youtube.com/embed/VIDEO_ID"
    title="Voygent Demo"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe>
</div>
```

---

## Thumbnails

### Quick Option: Screenshot from Video

1. Find a compelling frame in your video
2. Export: File → Export Frame
3. Add text in any image editor (GIMP, Canva)

### Better Option: Canva (Free)

1. Go to [canva.com](https://canva.com)
2. Search: "YouTube Thumbnail"
3. Start from a template
4. Add your screenshot + text

**Thumbnail guidelines:**
- Resolution: 1280x720 (minimum)
- Readable text (5 words or fewer)
- High contrast
- Face or compelling visual

**Suggested thumbnails:**

Travel Agent demo:
- Split screen: ugly spreadsheet → beautiful proposal
- Text: "Stop Planning Like This"

Tech demo:
- Architecture diagram with Claude + Cloudflare logos
- Text: "MCP Server in Production"

---

## Export Settings Reference

### For YouTube Upload

| Setting | Value |
|---------|-------|
| Container | MP4 |
| Video codec | H.264 |
| Resolution | 1920x1080 |
| Frame rate | 30 fps |
| Bitrate | 12-15 Mbps (or CRF 18-20) |
| Audio codec | AAC |
| Audio bitrate | 192 kbps |
| Sample rate | 48000 Hz |

In Shotcut, use the "YouTube" export preset for these settings automatically.

---

## Pre-Recording Environment Checklist

- [ ] **Resolution:** Settings → Displays → 1920x1080
- [ ] **Notifications off:** Settings → Notifications → Do Not Disturb ON
- [ ] **Close distractions:** Slack, email, other apps
- [ ] **Clean desktop:** Remove sensitive icons/files
- [ ] **Claude Desktop:** Clear old conversations or use fresh profile
- [ ] **Browser:** Close unnecessary tabs, use incognito if needed
- [ ] **Font size:** For code, set to 18-20px (VS Code: Ctrl+= to zoom)
- [ ] **Terminal:** Set to larger font if showing commands
- [ ] **Test recording:** Do a 10-second test to verify audio/video quality

---

## Troubleshooting

### SimpleScreenRecorder

**Black screen in recording:**
- Try X11 session instead of Wayland
- Log out, click gear icon at login, select "Ubuntu on Xorg"

**No sound:**
- Check PulseAudio is recording correct source
- Use `pavucontrol` to verify

### Shotcut

**Choppy playback:**
- Settings → Preview Scaling → 540p
- This doesn't affect export quality

**Export fails:**
- Check disk space
- Try different codec (HEVC → H.264)
- Update Shotcut to latest version

### YouTube

**Processing stuck:**
- Normal for HD videos, can take 30+ minutes
- Higher resolutions (1080p) are processed after lower ones

**Copyright claim on music:**
- Use only YouTube Audio Library tracks
- Or verify track is labeled for reuse

---

## Quick Reference: Full Workflow

```
1. SET UP
   sudo apt install simplescreenrecorder
   sudo snap install shotcut --classic

2. RECORD
   - Open SimpleScreenRecorder
   - Configure for 1080p/30fps/MP4
   - Record each scene separately
   - Files save to ~/Videos/

3. EDIT
   - Open Shotcut
   - Import clips (File → Open)
   - Drag to timeline, arrange
   - Add captions (Filters → Text: Simple)
   - Add music (new audio track)
   - Export (YouTube preset)

4. UPLOAD
   - YouTube Studio → Upload
   - Start as Unlisted
   - Add title, description, thumbnail
   - Review, then set to Public
   - Copy embed code for voygent.ai
```

Total time for basic video: 2-3 hours (recording + editing + upload)
