import { useSelector } from "react-redux";
import { confirmYes, confirmNo } from "../confirmService";
import { useState, useEffect } from "react";


export default function ConfirmPopup() {
  const { open, message, requiredInput } = useSelector((state) => state.confirm);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (open) setInputValue("");
  }, [open]);

  if (!open) return null;

  const isConfirmedDisabled = requiredInput && inputValue.toLowerCase() !== requiredInput.toLowerCase();



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      
      <div className="
        relative w-[320px] rounded-[26px] 
        border border-white/10 
        bg-white/5 
        backdrop-blur-xl 
        p-6 
        shadow-[0_20px_80px_rgba(0,0,0,0.6)]
      ">
        
        {/* subtle glow */}
        <div className="absolute inset-0 rounded-[26px] bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none" />

        <h2 className="text-sm font-semibold text-white tracking-wide">
          Confirm Action
        </h2>

        <p className="mt-3 text-xs text-gray-300 leading-relaxed">
          {message}
        </p>

        {requiredInput && (
          <div className="mt-4">
            <p className="text-[11px] text-zinc-500 tracking-wide mb-2 font-medium">
              Please type <span className="text-white font-bold">"{requiredInput}"</span> below:
            </p>


            <input
              autoFocus
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isConfirmedDisabled && confirmYes()}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-rose-500/50 transition-colors placeholder:text-zinc-600"
              placeholder={requiredInput}
            />

          </div>
        )}


        <div className="mt-5 flex justify-end gap-2">
          
          <button
            onClick={confirmNo}
            className="
              px-4 py-1.5 text-xs rounded-full 
              border border-white/10 
              bg-white/5 
              text-gray-200 
              backdrop-blur-md 
              hover:bg-white/10 
              transition
            "
          >
            Cancel
          </button>

          <button
            onClick={confirmYes}
            disabled={isConfirmedDisabled}
            className={`
              px-4 py-1.5 text-xs rounded-full 
              bg-gradient-to-br from-rose-500 to-rose-600 
              text-white 
              shadow-md 
              transition
              ${isConfirmedDisabled ? "opacity-30 cursor-not-allowed grayscale" : "hover:scale-[1.03] active:scale-[0.97]"}
            `}
          >
            Confirm
          </button>


        </div>
      </div>
    </div>
  );
}