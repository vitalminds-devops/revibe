//! Report text -> fields: the labeled layout technicians use in their chat reports.
use std::sync::LazyLock;

use regex::Regex;

use crate::domain::{Fields, REPORT_FIELDS};

/// Other ways a label is written, and the field each one fills.
const ALIASES: [(&str, &str); 4] = [
    ("date", "jo_date"),
    ("task", "task_no"),
    ("a/t", "action_taken"),
    ("at", "action_taken"),
];

/// (label as written, field), in the order the regex alternation must try them.
fn labels() -> impl Iterator<Item = (String, &'static str)> {
    let fields = REPORT_FIELDS.iter().map(|f| (f.replace('_', " "), *f));
    fields.chain(
        ALIASES
            .iter()
            .map(|(label, field)| (label.to_string(), *field)),
    )
}

static LABEL: LazyLock<Regex> = LazyLock::new(|| {
    let labels: Vec<String> = labels()
        .map(|(label, _)| {
            label
                .split(' ')
                .map(regex::escape)
                .collect::<Vec<_>>()
                .join(r"\s*[:;]?\s+")
        })
        .collect();
    Regex::new(&format!(
        r"(?i)\b(?P<label>{})\s*[:;]\s*|\b(?P<bare>team|cdz|task|arrival|departure|done rectification)\s*:?\s*",
        labels.join("|")
    ))
    .expect("label pattern is valid")
});
static SEPARATORS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[:;\s]+").unwrap());
static HEADER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)accomplishment report").unwrap());

/// Every field in REPORT_FIELDS, empty when the text doesn't have it.
pub fn parse_fields(text: &str) -> Fields {
    // shortcut: expects labeled technician reports; add layouts when other formats are required.
    let mut fields: Fields = REPORT_FIELDS
        .iter()
        .map(|f| (f.to_string(), "".into()))
        .collect();
    let set = |fields: &mut Fields, key: &str, value: &str| {
        fields.insert(key.into(), value.into());
    };
    let get = |fields: &Fields, key: &str| fields[key].as_str().unwrap_or_default().to_string();

    let matches: Vec<_> = LABEL
        .captures_iter(text)
        .filter(|c| {
            // A bare label must be followed by a space, digit or colon (the regex crate has no lookahead).
            c.name("bare").is_none_or(|bare| {
                text[bare.end()..]
                    .starts_with(|ch: char| ch.is_whitespace() || ch.is_ascii_digit() || ch == ':')
            })
        })
        .collect();
    for (index, c) in matches.iter().enumerate() {
        let written = c
            .name("label")
            .or(c.name("bare"))
            .expect("one group matched")
            .as_str();
        let label = SEPARATORS.replace_all(written, " ").to_lowercase();
        let field = labels()
            .find(|(l, _)| *l == label)
            .expect("matched a known label")
            .1;
        let start = c.get(0).unwrap().end();
        let end = matches
            .get(index + 1)
            .map_or(text.len(), |next| next.get(0).unwrap().start());
        set(
            &mut fields,
            field,
            // Beyond spaces and separators: marks OCR makes of chat-app icons next to a line.
            text[start..end].trim_matches(|c: char| c.is_whitespace() || ":-\"'+(@~".contains(c)),
        );
    }

    // "<name> Accomplishment Report <date>" heading.
    if let Some(header) = HEADER.find(text) {
        set(&mut fields, "technician", text[..header.start()].trim());
        let date = text[header.end()..]
            .trim()
            .lines()
            .next()
            .unwrap_or("")
            .trim();
        set(&mut fields, "report_date", date);
    }
    // "Team5 Luke/J Soriano": the team number, then its members.
    if let Some((team, members)) = get(&fields, "team").split_once(char::is_whitespace) {
        set(&mut fields, "team", team);
        set(&mut fields, "members", members.trim_start());
    }
    // The line after the remarks says what was done.
    if let Some((remarks, work_done)) = get(&fields, "remarks").split_once('\n') {
        set(&mut fields, "remarks", remarks);
        set(&mut fields, "work_done", work_done);
    }
    fields
}

/// Text of several screenshots of one message, in order, without the lines repeated where they overlap.
pub fn join_parts(parts: &[String]) -> String {
    // shortcut: drops exact repeats only; OCR differences in a cut-off line still repeat it.
    let mut lines: Vec<&str> = Vec::new();
    for part in parts {
        let tail: Vec<&str> = lines[lines.len().saturating_sub(8)..]
            .iter()
            .map(|l| l.trim())
            .collect();
        let mut new = part.lines().peekable();
        while new.peek().is_some_and(|line| tail.contains(&line.trim())) {
            new.next();
        }
        lines.extend(new);
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn join_parts_drops_lines_repeated_where_screenshots_overlap() {
        let parts = [
            "Task: 1\nCategory: Repair",
            "Category: Repair\nRFO: Kink",
            "RFO: Kink",
        ]
        .map(String::from);
        assert_eq!(join_parts(&parts), "Task: 1\nCategory: Repair\nRFO: Kink");
        assert_eq!(join_parts(&["".into(), "Task: 1".into()]), "Task: 1");
    }

    #[test]
    fn report_layout_and_multiline_values() {
        let fields = parse_fields(
            "Luke Nhel Marino Accomplishment Report November 10 2026\n\
             Team5 Luke/J Soriano/A Gupo CDZ 6476\n\
             Task 1 Category: Repair Service Type: NAP\n\
             JO Number: JO-20261031-0005 Date: Oct 31, 2026\n\
             PMS Ticket: Trouble Ticket: Channel: Viber GC\n\
             Nap: Code: BUM001 LP23 NP7\n\
             Remarks: Repair needed\nBUM001 LP23 NP7 - NAP Split\n\
             Arrival 8:00 AM Departure 8:20 AM Done Rectification 12:00 PM\n\
             RFO: Kink fiber\nat NP Box\nA/T: Resplice fiber",
        );
        for (key, value) in [
            ("technician", "Luke Nhel Marino"),
            ("report_date", "November 10 2026"),
            ("team", "5"),
            ("members", "Luke/J Soriano/A Gupo"),
            ("cdz", "6476"),
            ("task_no", "1"),
            ("category", "Repair"),
            ("service_type", "NAP"),
            ("jo_number", "JO-20261031-0005"),
            ("jo_date", "Oct 31, 2026"),
            ("pms_ticket", ""),
            ("trouble_ticket", ""),
            ("channel", "Viber GC"),
            ("remarks", "Repair needed"),
            ("work_done", "BUM001 LP23 NP7 - NAP Split"),
            ("nap_code", "BUM001 LP23 NP7"),
            ("arrival", "8:00 AM"),
            ("departure", "8:20 AM"),
            ("done_rectification", "12:00 PM"),
            ("rfo", "Kink fiber\nat NP Box"),
            ("action_taken", "Resplice fiber"),
        ] {
            assert_eq!(fields[key], value, "{key}");
        }
        assert_eq!(
            fields.keys().collect::<Vec<_>>(),
            REPORT_FIELDS.iter().collect::<Vec<_>>()
        );
    }
}
