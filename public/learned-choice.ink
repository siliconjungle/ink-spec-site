module learned_choice;

fn authored(flag: Bool) -> Option<Bool> {
    return choose(flag, Some(true), None);
}

fn decide(flag: Bool) -> Bool {
    return authored(flag).unwrap_or(learn recover(flag): choice<Bool>);
}

query answer(flag: Bool) -> Bool {
    return decide(flag);
}

objective mistakes() -> f32 {
    return choose(decide(false), 0.0, 1.0);
}
