module notifications;

effect summarise(text: String) -> String;
ordered effect notify(message: String) -> Result<Unit, String>;

task send_summary(text: String) -> Result<String, String> {
    let summary = summarise(text)
        ensures string_byte_len(summary) <= 140 else "Summary unavailable";
    notify(summary)?;
    return Ok(summary);
}
