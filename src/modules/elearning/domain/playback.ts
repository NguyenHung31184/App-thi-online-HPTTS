export interface PlaybackSample { position: number; wallTime: number; playing: boolean; visible: boolean; seeking: boolean; rate: number }
export interface PlaybackInterval { from: number; to: number }

/** Only contiguous playback observed in real time is credited; a seek establishes a new anchor. */
export function playbackInterval(previous: PlaybackSample | null, current: PlaybackSample): PlaybackInterval | null {
  if (!previous || !previous.playing || !current.playing || !previous.visible || !current.visible || previous.seeking || current.seeking) return null;
  const elapsed=(current.wallTime-previous.wallTime)/1000;
  const delta=current.position-previous.position;
  if (!Number.isFinite(delta) || elapsed<=0 || elapsed>3 || current.rate<=0 || current.rate>2 || delta<=0 || delta>elapsed*current.rate+0.5) return null;
  const from=Math.floor(previous.position),to=Math.floor(current.position);
  return to>from ? {from,to} : null;
}

/** Small chunks fit the server's elapsed-time budget even after pause or seek. */
export function appendPlayback(queue: PlaybackInterval[], interval: PlaybackInterval): PlaybackInterval[] {
  const next=queue.map((item) => ({...item}));
  let from=interval.from;
  while (from<interval.to) {
    const last=next[next.length-1];
    if (last && last.to===from && last.to-last.from<3) {
      const end=Math.min(interval.to,last.from+3);
      last.to=end;from=end;
    } else {
      const to=Math.min(interval.to,from+3);
      next.push({from,to});from=to;
    }
  }
  return next;
}
