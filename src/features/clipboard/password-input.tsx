import { CLIPBOARD_PASSWORD_MAX_LENGTH } from "@shared/clipboard";
import { Eye, EyeOff } from "lucide-react";
import { type Ref, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  inputRef,
  minLength,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  minLength?: number;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field-group">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          ref={inputRef}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={minLength}
          maxLength={CLIPBOARD_PASSWORD_MAX_LENGTH}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="pr-11"
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-0.5 right-1 size-8"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-6 text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
