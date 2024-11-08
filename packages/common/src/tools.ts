import chalk = require("chalk");

export class Tools {
  public static shortLog(options: { input: string; len?: number }): string {
    const { input, len } = options;
    const maxLength = len ?? input.length;

    const envXapiLogFull: any = process.env.XAPI_LOG_FULL;
    if (
      envXapiLogFull === 1 ||
      envXapiLogFull === "1" ||
      envXapiLogFull === "true"
    ) {
      return input;
    }
    return Tools.ellipsisText({
      text: input,
      len: input.length > maxLength ? maxLength : input.length,
      suffix: "...",
    }) + chalk.gray("(set XAPI_LOG_FULL=1 to show)");
  }

  public static ellipsisText(options: {
    text: string;
    len?: number;
    suffix?: string;
  }): string {
    const { text, len, suffix } = options;
    if (!text) return text;
    const tlen = text.length;
    const clen = len ?? tlen;

    return clen < tlen
      ? text.substring(0, clen) + (suffix ? suffix : "")
      : text;
  }
}
