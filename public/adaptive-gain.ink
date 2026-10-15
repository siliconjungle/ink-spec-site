module adaptive_gain;

trainable state Gain: f32 = 1.0;

adaptive query predict(x: f32) -> f32 reads(Gain) {
    return Gain * x;
}

learn change feedback(x: f32, target: f32) -> Result<Unit, String>
    reads(Gain) writes(Gain) {
    let error = Gain * x - target;
    Gain = Gain - 0.01 * error * x;
    return Ok(());
}
