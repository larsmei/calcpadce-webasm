using System;
using System.IO;
using System.IO.Compression;

namespace Calcpad.Core
{
    /// <summary>Minimal PNG encoder so contour maps work in WebAssembly without libSkiaSharp.</summary>
    internal static class RawPng
    {
        private static readonly uint[] CrcTable = CreateCrcTable();

        internal static string ToDataUri(byte[] rgba, int width, int height) =>
            "data:image/png;base64," + Convert.ToBase64String(Encode(rgba, width, height));

        internal static byte[] Encode(byte[] rgba, int width, int height)
        {
            var rowBytes = 1 + width * 4;
            var raw = new byte[height * rowBytes];
            for (int y = 0; y < height; y++)
            {
                var src = y * width * 4;
                var dst = y * rowBytes;
                raw[dst] = 0;
                Buffer.BlockCopy(rgba, src, raw, dst + 1, width * 4);
            }

            using var idat = new MemoryStream();
            using (var zlib = new ZLibStream(idat, CompressionLevel.Fastest, leaveOpen: true))
                zlib.Write(raw, 0, raw.Length);

            var idatBytes = idat.ToArray();
            using var png = new MemoryStream(8 + 25 + 12 + idatBytes.Length + 12);
            png.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            WriteChunk(png, "IHDR"u8, Ihdr(width, height));
            WriteChunk(png, "IDAT"u8, idatBytes);
            WriteChunk(png, "IEND"u8, []);
            return png.ToArray();
        }

        private static byte[] Ihdr(int width, int height)
        {
            var b = new byte[13];
            WriteBe(b, 0, width);
            WriteBe(b, 4, height);
            b[8] = 8;
            b[9] = 6;
            return b;
        }

        private static void WriteChunk(Stream s, ReadOnlySpan<byte> type, byte[] data)
        {
            var len = new byte[4];
            WriteBe(len, 0, data.Length);
            s.Write(len);
            s.Write(type);
            s.Write(data);
            uint crc = 0xFFFFFFFF;
            foreach (var c in type)
                crc = CrcTable[(crc ^ c) & 0xFF] ^ (crc >> 8);
            foreach (var c in data)
                crc = CrcTable[(crc ^ c) & 0xFF] ^ (crc >> 8);
            var crcBytes = new byte[4];
            WriteBe(crcBytes, 0, (int)(crc ^ 0xFFFFFFFF));
            s.Write(crcBytes);
        }

        private static void WriteBe(byte[] b, int i, int v)
        {
            b[i] = (byte)(v >> 24);
            b[i + 1] = (byte)(v >> 16);
            b[i + 2] = (byte)(v >> 8);
            b[i + 3] = (byte)v;
        }

        private static uint[] CreateCrcTable()
        {
            var t = new uint[256];
            for (uint n = 0; n < 256; n++)
            {
                var c = n;
                for (int k = 0; k < 8; k++)
                    c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
                t[n] = c;
            }
            return t;
        }
    }
}
