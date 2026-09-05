using System.Globalization;
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using System.Text.Json.Serialization;
using Calcpad.Core;
using Microsoft.JSInterop;

namespace Calcpad.Wasm;

public static partial class CalcpadBridge
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    [JSInvokable]
    [JSExport]
    public static string Ping() => "ok";

    /// <summary>JSInvokable fallback: JSON envelope (HTML is escaped).</summary>
    [JSInvokable]
    public static string Parse(string sourceCode, string optionsJson)
    {
        var result = Run(sourceCode, optionsJson);
        return JsonSerializer.Serialize(result, JsonOptions);
    }

    /// <summary>JSExport path: one JSON metadata line, then raw HTML (no extra escaping).</summary>
    [JSExport]
    public static string ParseRaw(string sourceCode, string optionsJson)
    {
        var result = Run(sourceCode, optionsJson);
        var meta = JsonSerializer.Serialize(new ParseMeta { Errors = result.Errors, Ok = result.Ok }, JsonOptions);
        return meta + "\n" + result.Html;
    }

    private static ParseResult Run(string? sourceCode, string? optionsJson)
    {
        CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
        CultureInfo.CurrentUICulture = CultureInfo.InvariantCulture;

        var options = string.IsNullOrWhiteSpace(optionsJson)
            ? new ParseOptions()
            : JsonSerializer.Deserialize<ParseOptions>(optionsJson, JsonOptions) ?? new ParseOptions();

        var settings = new Settings
        {
            Units = string.IsNullOrWhiteSpace(options.Units) ? "m" : options.Units,
            IsUs = options.IsUs
        };
        settings.Math.Decimals = options.Decimals;
        settings.Math.Degrees = options.Degrees;
        settings.Math.IsComplex = options.Complex;
        settings.Math.Substitute = options.Substitute;
        settings.Math.FormatEquations = true;
        settings.Plot.VectorGraphics = true;
        settings.Plot.IsAdaptive = true;
        settings.Plot.ScreenScaleFactor = 1;
        settings.Plot.Width = options.PlotWidth;
        settings.Plot.Height = options.PlotHeight;

        var errors = new List<ErrorDto>();
        var unwrapped = sourceCode ?? string.Empty;

        try
        {
            PathRoots pathRoots;
            if (NeedsMacros(unwrapped))
            {
                var macroParser = new MacroParser
                {
                    Include = (path, _) => $"' [include skipped in browser: {path}]\n",
                    SourceFilePath = options.FileName ?? "worksheet.cpd"
                };
                var hasMacroErrors = macroParser.Parse(sourceCode ?? string.Empty, out unwrapped, null, 0, true);
                if (hasMacroErrors && macroParser.Errors is not null)
                {
                    foreach (var err in macroParser.Errors)
                        errors.Add(ToError(err));
                }
                pathRoots = macroParser.PathRoots;
            }
            else
            {
                pathRoots = new PathRoots();
            }

            var parser = new ExpressionParser
            {
                Settings = settings,
                SourceFilePath = options.FileName ?? "worksheet.cpd",
                PathRoots = pathRoots,
                Debug = options.Debug,
                ShowWarnings = true,
                EnableUi = options.EnableUi,
                ForPrint = options.ForPrint,
                UiOverrides = options.UiOverrides
            };
            parser.Parse(unwrapped, options.Calculate, getXml: false);
            if (parser.Errors is not null)
            {
                foreach (var err in parser.Errors)
                    errors.Add(ToError(err));
            }

            return new ParseResult
            {
                Html = parser.HtmlResult ?? string.Empty,
                Errors = errors,
                Ok = errors.Count == 0
            };
        }
        catch (Exception ex)
        {
            errors.Add(new ErrorDto { Line = 0, Message = ex.Message, Source = "Expression" });
            return new ParseResult
            {
                Html = $"<p class=\"err\">{System.Web.HttpUtility.HtmlEncode(ex.Message)}</p>",
                Errors = errors,
                Ok = false
            };
        }
    }

    internal static bool NeedsMacros(string source)
    {
        if (source.IndexOf('#') < 0) return false;
        return source.Contains("#def", StringComparison.OrdinalIgnoreCase)
            || source.Contains("#include", StringComparison.OrdinalIgnoreCase)
            || source.Contains("#end def", StringComparison.OrdinalIgnoreCase)
            || source.Contains("#projectpath", StringComparison.OrdinalIgnoreCase)
            || source.Contains("#librarypath", StringComparison.OrdinalIgnoreCase);
    }

    private static ErrorDto ToError(CalcpadError err) => new()
    {
        Line = err.SourceLine,
        OutputLine = err.OutputLine,
        Message = err.Message,
        Source = err.Source.ToString()
    };

    private sealed class ParseOptions
    {
        public bool Calculate { get; set; } = true;
        public bool EnableUi { get; set; }
        public bool ForPrint { get; set; }
        public Dictionary<string, string>? UiOverrides { get; set; }
        public int Decimals { get; set; } = 6;
        public int Degrees { get; set; } = 0;
        public bool Complex { get; set; }
        public bool Substitute { get; set; } = true;
        public bool Debug { get; set; } = true;
        public bool IsUs { get; set; }
        public string Units { get; set; } = "m";
        public string FileName { get; set; } = "worksheet.cpd";
        public int PlotWidth { get; set; } = 520;
        public int PlotHeight { get; set; } = 320;
    }

    private sealed class ParseMeta
    {
        public List<ErrorDto> Errors { get; set; } = [];
        public bool Ok { get; set; }
    }

    private sealed class ParseResult
    {
        public string Html { get; set; } = string.Empty;
        public List<ErrorDto> Errors { get; set; } = [];
        public bool Ok { get; set; }
    }

    private sealed class ErrorDto
    {
        public int Line { get; set; }
        public int OutputLine { get; set; }
        public string Message { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty;
    }
}
