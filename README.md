# 📱 Windows Media Controller

This project allows you to control Windows media playback (Spotify, YouTube, etc.) from a Flutter mobile app.

## 💻 1. Server Setup (Windows)

The server must be run on the Windows PC you wish to control.

### Prerequisites
- [Node.js](https://nodejs.org/) installed.
- Windows 10 (version 1809+) or Windows 11.

### Installation
1. Copy the `server` directory to your Windows PC.
2. Open a terminal (CMD or PowerShell) in the `server` directory.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   node index.js
   ```
5. **Firewall**: Ensure that your Windows Firewall allows Node.js to receive incoming connections on port **8080** and **mDNS (5353)**.

---

## 📱 2. Mobile App Setup (Flutter)

### Prerequisites
- [Flutter SDK](https://docs.flutter.dev/get-started/install) installed.

### Installation
1. Open the `app` directory.
2. Install dependencies:
   ```bash
   flutter pub get
   ```
3. Run the app on your phone (make sure it's on the same Wi-Fi as your PC):
   ```bash
   flutter run
   ```

---

## ✨ Features
- **Auto Discovery**: No need to type IP addresses; the app finds your PC automatically using mDNS.
- **Real-time Sync**: Song titles, artists, and album art (thumbnails) sync instantly.
- **Media Controls**: Play/Pause, Next, and Previous track.
- **Notification Support**: Control your PC from your phone's notification bar or lock screen.

## ⚠️ Troubleshooting
- **Cannot find PC**: Ensure both devices are on the same Wi-Fi network.
- **Album Art missing**: Not all media players provide a thumbnail to the Windows SMTC API. Chrome (YouTube) and Spotify generally work well.
- **Permissions**: On Android/iOS, the app may request "Local Network Access" permissions.
