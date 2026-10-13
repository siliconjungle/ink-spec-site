module documents;
import "std:json" as json;

fn mark_received(document: json.Json) -> Result<json.Json, json.JsonError> {
    return json.set(document, "received", json.boolean(true));
}
fn identity(document: json.Json) -> json.Json { return document; }
