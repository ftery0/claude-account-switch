using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;

public static class ConsoleSmoke
{
    [StructLayout(LayoutKind.Sequential)]
    private struct Coord { public short X, Y; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct StartupInfo
    {
        public int Size;
        public string Reserved, Desktop, Title;
        public int X, Y, XSize, YSize, XCount, YCount, Fill, Flags;
        public short Show, ReservedSize;
        public IntPtr ReservedBytes, Input, Output, Error;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfoEx { public StartupInfo Startup; public IntPtr Attributes; }
    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInfo { public IntPtr Process, Thread; public int ProcessId, ThreadId; }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CreatePipe(out IntPtr read, out IntPtr write, IntPtr security, int size);
    [DllImport("kernel32.dll")]
    private static extern int CreatePseudoConsole(Coord size, IntPtr input, IntPtr output, int flags, out IntPtr console);
    [DllImport("kernel32.dll")]
    private static extern void ClosePseudoConsole(IntPtr console);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool InitializeProcThreadAttributeList(IntPtr attributes, int count, int flags, ref IntPtr size);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool UpdateProcThreadAttribute(IntPtr attributes, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returned);
    [DllImport("kernel32.dll")]
    private static extern void DeleteProcThreadAttributeList(IntPtr attributes);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CreateProcess(string app, StringBuilder command, IntPtr processSecurity, IntPtr threadSecurity, bool inherit, uint flags, IntPtr environment, string directory, ref StartupInfoEx startup, out ProcessInfo process);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool ReadFile(IntPtr file, byte[] bytes, int count, out int read, IntPtr overlapped);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool WriteFile(IntPtr file, byte[] bytes, int count, out int written, IntPtr overlapped);
    [DllImport("kernel32.dll")]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll")]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll")]
    private static extern bool TerminateProcess(IntPtr process, uint code);
    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    private static void Check(bool success, string operation)
    {
        if (!success) throw new Exception(operation + ": " + Marshal.GetLastWin32Error());
    }

    public static int Main()
    {
        IntPtr inputRead = IntPtr.Zero, inputWrite = IntPtr.Zero;
        IntPtr outputRead = IntPtr.Zero, outputWrite = IntPtr.Zero;
        IntPtr console = IntPtr.Zero, attributes = IntPtr.Zero;
        var process = new ProcessInfo();
        bool attributeReady = false;
        try
        {
            Check(CreatePipe(out inputRead, out inputWrite, IntPtr.Zero, 0), "input pipe");
            Check(CreatePipe(out outputRead, out outputWrite, IntPtr.Zero, 0), "output pipe");
            int result = CreatePseudoConsole(new Coord { X = 120, Y = 30 }, inputRead, outputWrite, 0, out console);
            if (result != 0) throw new Exception("CreatePseudoConsole: " + result);
            IntPtr bytes = IntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref bytes);
            attributes = Marshal.AllocHGlobal(bytes);
            Check(InitializeProcThreadAttributeList(attributes, 1, 0, ref bytes), "attribute initialization");
            attributeReady = true;
            Check(UpdateProcThreadAttribute(attributes, 0, new IntPtr(0x20016), console, new IntPtr(IntPtr.Size), IntPtr.Zero, IntPtr.Zero), "pseudoconsole attribute");
            var startup = new StartupInfoEx();
            startup.Startup.Size = Marshal.SizeOf(typeof(StartupInfoEx));
            startup.Attributes = attributes;
            // Null standard handles prevent inheriting the CI host pipes instead of the console.
            startup.Startup.Flags = 0x100;
            var command = new StringBuilder(Environment.GetEnvironmentVariable("CAS_CONSOLE_COMMAND"));
            Check(CreateProcess(null, command, IntPtr.Zero, IntPtr.Zero, false, 0x80000, IntPtr.Zero, null, ref startup, out process), "console process");
            CloseHandle(inputRead); inputRead = IntPtr.Zero;
            CloseHandle(outputWrite); outputWrite = IntPtr.Zero;
            var reader = new Thread(delegate()
            {
                using (var log = new FileStream(Environment.GetEnvironmentVariable("CAS_CONSOLE_LOG"), FileMode.Create, FileAccess.Write, FileShare.ReadWrite))
                {
                    var buffer = new byte[4096];
                    int count;
                    while (ReadFile(outputRead, buffer, buffer.Length, out count, IntPtr.Zero) && count > 0)
                    {
                        log.Write(buffer, 0, count);
                        log.Flush();
                    }
                }
            });
            reader.IsBackground = true;
            reader.Start();
            DateTime deadline = DateTime.UtcNow.AddSeconds(60);
            string marker = Environment.GetEnvironmentVariable("CAS_FAKE_MARKER");
            while (!File.Exists(marker) && DateTime.UtcNow < deadline)
            {
                if (WaitForSingleObject(process.Process, 0) == 0) throw new Exception("Process exited before Claude fixture started");
                Thread.Sleep(50);
            }
            if (!File.Exists(marker)) throw new Exception("Claude fixture did not start");
            Thread.Sleep(500);
            int written;
            Check(WriteFile(inputWrite, new byte[] { 3 }, 1, out written, IntPtr.Zero), "Ctrl-C input");
            if (written != 1) throw new Exception("Ctrl-C byte was not delivered");
            if (WaitForSingleObject(process.Process, 30000) != 0) throw new Exception("Ctrl-C did not terminate the process");
            uint code;
            Check(GetExitCodeProcess(process.Process, out code), "exit code");
            ClosePseudoConsole(console); console = IntPtr.Zero;
            CloseHandle(inputWrite); inputWrite = IntPtr.Zero;
            reader.Join(5000);
            Console.WriteLine("{\"sentCtrlC\":true,\"exitCode\":" + code + "}");
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.ToString());
            return 1;
        }
        finally
        {
            if (process.Process != IntPtr.Zero)
            {
                if (WaitForSingleObject(process.Process, 0) != 0) TerminateProcess(process.Process, 99);
                CloseHandle(process.Process);
            }
            if (process.Thread != IntPtr.Zero) CloseHandle(process.Thread);
            if (console != IntPtr.Zero) ClosePseudoConsole(console);
            foreach (IntPtr handle in new[] { inputRead, inputWrite, outputRead, outputWrite })
                if (handle != IntPtr.Zero) CloseHandle(handle);
            if (attributeReady) DeleteProcThreadAttributeList(attributes);
            if (attributes != IntPtr.Zero) Marshal.FreeHGlobal(attributes);
        }
    }
}
