// 同一首歌以不同 ID 收录的重复曲目分组
// 每组内只保留 rating 最高的一首参与统计（v1/v2 通用）
export interface DuplicateSongRef {
  id: number
  difficulty: number
}

export const DUPLICATE_SONGS: DuplicateSongRef[][] = [
  [{ id: 399, difficulty: 4 }, { id: 400, difficulty: 4 }],
  [{ id: 399, difficulty: 5 }, { id: 400, difficulty: 5 }],
  [{ id: 450, difficulty: 4 }, { id: 1257, difficulty: 4 }],
  [{ id: 141, difficulty: 4 }, { id: 1258, difficulty: 4 }],
  [{ id: 137, difficulty: 4 }, { id: 1259, difficulty: 4 }],
  [{ id: 750, difficulty: 4 }, { id: 1260, difficulty: 4 }],
  [{ id: 527, difficulty: 4 }, { id: 1261, difficulty: 4 }],
  [{ id: 323, difficulty: 4 }, { id: 1262, difficulty: 4 }],
  [{ id: 939, difficulty: 4 }, { id: 1263, difficulty: 4 }],
  [{ id: 1146, difficulty: 4 }, { id: 1264, difficulty: 4 }],
  [{ id: 1146, difficulty: 5 }, { id: 1264, difficulty: 5 }],
  [{ id: 433, difficulty: 5 }, { id: 1265, difficulty: 5 }],
  [{ id: 433, difficulty: 4 }, { id: 1265, difficulty: 4 }],
  [{ id: 191, difficulty: 4 }, { id: 1266, difficulty: 4 }],
]
