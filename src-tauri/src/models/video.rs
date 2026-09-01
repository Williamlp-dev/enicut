use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    pub path: String,
    pub name: String,

    pub duration: f64, // segundos

    pub width: u32,
    pub height: u32,

    pub fps: f64,

    pub video_codec: String,
    pub audio_codec: Option<String>,

    pub bitrate: Option<u64>, // bits por segundo

    pub file_size: u64, // bytes
}
