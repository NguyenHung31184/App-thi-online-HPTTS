import { describe,expect,it } from 'vitest';
import { appendPlayback,playbackInterval,type PlaybackSample } from './playback';
const sample: PlaybackSample={position:10,wallTime:10000,playing:true,visible:true,seeking:false,rate:1};
describe('observed video playback', () => {
  it('credits natural playback but does not count seeking, background playback, pauses or a jump to the end', () => {
    expect(playbackInterval(sample,{...sample,position:11,wallTime:11000})).toEqual({from:10,to:11});
    for (const patch of [{position:90},{seeking:true},{visible:false},{playing:false},{rate:3}])
      expect(playbackInterval(sample,{...sample,position:11,wallTime:11000,...patch})).toBeNull();
    expect(playbackInterval(sample,{...sample,position:90,wallTime:90000})).toBeNull();
  });
  it('merges contiguous playback into small requests and preserves gaps after seeks', () => {
    const queue=appendPlayback(appendPlayback([],{from:0,to:2}),{from:2,to:7});
    expect(queue).toEqual([{from:0,to:3},{from:3,to:6},{from:6,to:7}]);
    expect(appendPlayback(queue,{from:90,to:92})).toEqual([...queue,{from:90,to:92}]);
  });
});
