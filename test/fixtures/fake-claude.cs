using System;
using System.IO;
using System.Text;
using System.Threading;

public static class FakeClaude
{
    private static string Quote(string value)
    {
        if (value == null) return "null";
        var result = new StringBuilder("\"");
        foreach (char character in value)
        {
            if (character == '\\' || character == '"') result.Append('\\').Append(character);
            else if (character == '\n') result.Append("\\n");
            else if (character == '\r') result.Append("\\r");
            else if (character == '\t') result.Append("\\t");
            else if (character < 32) result.Append("\\u").Append(((int)character).ToString("x4"));
            else result.Append(character);
        }
        return result.Append('"').ToString();
    }

    public static int Main(string[] arguments)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        var encoded = new string[arguments.Length];
        for (int index = 0; index < arguments.Length; index++) encoded[index] = Quote(arguments[index]);
        var output = "{\"fake\":true,\"args\":[" + string.Join(",", encoded)
            + "],\"config\":" + Quote(Environment.GetEnvironmentVariable("CLAUDE_CONFIG_DIR"))
            + ",\"hook\":" + Quote(Environment.GetEnvironmentVariable("CAS_HOOK")) + "}";
        string marker = Environment.GetEnvironmentVariable("CAS_FAKE_MARKER");
        if (!string.IsNullOrEmpty(marker)) File.AppendAllText(marker, output + Environment.NewLine, new UTF8Encoding(false));
        if (Environment.GetEnvironmentVariable("CAS_FAKE_QUIET") != "1") Console.WriteLine(output);
        int delay;
        if (int.TryParse(Environment.GetEnvironmentVariable("CAS_FAKE_SLEEP_MS"), out delay) && delay > 0) Thread.Sleep(delay);
        int code;
        return int.TryParse(Environment.GetEnvironmentVariable("CAS_FAKE_EXIT"), out code) ? code : 0;
    }
}
