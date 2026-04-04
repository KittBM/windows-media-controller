using System;
using System.Runtime.InteropServices;

namespace MediaKeys
{
    class Program
    {
        public const int VK_MEDIA_NEXT_TRACK = 0xB0;
        public const int VK_MEDIA_PREV_TRACK = 0xB1;
        public const int VK_MEDIA_STOP = 0xB2;
        public const int VK_MEDIA_PLAY_PAUSE = 0xB3;
        public const int KEYEVENTF_EXTENDEDKEY = 0x0001;
        public const int KEYEVENTF_KEYUP = 0x0002;

        [DllImport("user32.dll", SetLastError = true)]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);

        static void Main(string[] args)
        {
            if (args.Length == 0) return;
            string cmd = args[0];
            byte vk = 0;
            switch(cmd) {
                case "PLAY_PAUSE": vk = VK_MEDIA_PLAY_PAUSE; break;
                case "NEXT": vk = VK_MEDIA_NEXT_TRACK; break;
                case "PREVIOUS": vk = VK_MEDIA_PREV_TRACK; break;
                case "STOP": vk = VK_MEDIA_STOP; break;
            }
            if (vk != 0) {
                keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY, IntPtr.Zero);
                keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, IntPtr.Zero);
            }
        }
    }
}
