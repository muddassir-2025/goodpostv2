import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { DownloadIcon, PauseIcon, PlayIcon, VolumeIcon, VolumeMutedIcon } from "./ui/Icons";

/**
 * Premium Custom Audio Player
 * Features: Spotify-like glassmorphism, custom controls, volume handling, and download.
 */
const AudioPlayer = forwardRef(({ src, title }, ref) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useImperativeHandle(ref, () => ({
    skipForward: () => {
      if (!audioRef.current) return;
      audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 5, audioRef.current.duration || 0);
      setCurrentTime(audioRef.current.currentTime);
      setSeekFeedback({ type: "forward" });
      setTimeout(() => setSeekFeedback(null), 600);
    },
    skipBackward: () => {
      if (!audioRef.current) return;
      audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 5, 0);
      setCurrentTime(audioRef.current.currentTime);
      setSeekFeedback({ type: "backward" });
      setTimeout(() => setSeekFeedback(null), 600);
    },
    togglePlay: () => togglePlay()
  }));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
      }
    };
    
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [isDragging]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
  };

  const handleSeekEnd = (e) => {
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setIsDragging(false);
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    audioRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = src;
    link.download = title || "audio-file";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [seekFeedback, setSeekFeedback] = useState(null); // { type: 'forward' | 'backward', x, y }

  const handleCardClick = (e) => {
    if (e.target.closest("button") || e.target.closest("input")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isRight = x > rect.width / 2;

    if (isRight) {
      audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 5, duration);
      setSeekFeedback({ type: "forward", x: e.clientX, y: e.clientY });
    } else {
      audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 5, 0);
      setSeekFeedback({ type: "backward", x: e.clientX, y: e.clientY });
    }
    setCurrentTime(audioRef.current.currentTime);
    
    setTimeout(() => setSeekFeedback(null), 600);
  };

  return (
    <div 
      onClick={handleCardClick}
      className="group relative cursor-pointer overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur-2xl transition-all duration-500 hover:bg-white/10 hover:border-white/20 active:scale-[0.99]"
    >
      {/* Seek Feedback Indicator */}
      {seekFeedback && (
        <div 
          className="pointer-events-none absolute z-50 flex flex-col items-center justify-center text-white/80 animate-in fade-in zoom-in duration-300"
          style={{ 
            left: seekFeedback.type === 'forward' ? '70%' : '30%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <span className="text-xl font-black">{seekFeedback.type === 'forward' ? '5' : '-5'}</span>
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 w-1.5 rounded-full bg-white/40 ${seekFeedback.type === 'forward' ? 'animate-bounce' : 'animate-bounce'}`} 
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        </div>
      )}
      <audio ref={audioRef} src={src} />
      
      {/* Dynamic Background Glow */}
      <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5 blur-3xl transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
      
      <div className="relative flex items-center gap-5">
        {/* Play/Pause Button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_8px_20px_rgba(255,255,255,0.2)] transition-all duration-300 hover:scale-110 active:scale-95"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <PauseIcon className="h-5 w-5" />
            ) : (
              <PlayIcon className="h-5 w-5 ml-1" />
            )}
          </button>
          
          {/* Waveform Animation (Hidden when paused) */}
          {isPlaying && (
            <div className="absolute -inset-1.5 animate-pulse rounded-full border border-white/20" />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between px-1">
             <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                 {formatTime(currentTime)}
               </span>
               {isPlaying && (
                 <div className="flex gap-0.5 h-2">
                   {[...Array(3)].map((_, i) => (
                     <div 
                       key={i}
                       className="w-0.5 bg-zinc-500 rounded-full animate-waveform"
                       style={{ animationDelay: `${i * 0.2}s` }}
                     />
                   ))}
                 </div>
               )}
             </div>
             <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
               {formatTime(duration)}
             </span>
          </div>
          
          {/* Progress Bar Container */}
          <div className="relative h-1.5 w-full rounded-full bg-white/10">
            <div 
              className="absolute h-full rounded-full bg-white transition-all duration-150" 
              style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
            />
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.01"
              value={currentTime}
              onMouseDown={() => setIsDragging(true)}
              onChange={handleSeek}
              onMouseUp={handleSeekEnd}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={handleSeekEnd}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
        </div>

        {/* Controls: Volume & Download */}
        <div className="flex items-center gap-4">
          <div className="group/volume relative flex items-center gap-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className="text-zinc-400 transition-colors hover:text-white"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <VolumeMutedIcon className="h-5 w-5" />
              ) : (
                <VolumeIcon className="h-5 w-5" />
              )}
            </button>
            
            {/* Volume Slider - Revealed on group hover */}
            <div className="w-0 overflow-hidden transition-all duration-300 group-hover/volume:w-20">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                onClick={(e) => e.stopPropagation()}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white outline-none"
              />
            </div>
          </div>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/5 text-zinc-400 transition-all hover:border-white/20 hover:bg-white/5 hover:text-white"
            title="Download Audio"
          >
            <DownloadIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default AudioPlayer;
