import {
  CLIPBOARD_PASSWORD_MIN_LENGTH,
  type CreatedClipboard,
  clipboardByteLength,
  MAX_CLIPBOARD_BYTES,
  type RetrievedClipboard,
} from "@shared/clipboard";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Clock3,
  CloudUpload,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Send,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolPanel } from "@/components/tools/tool-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ClipboardPasswordError,
  createShare,
  deleteShare,
  parseCredential,
  retrieveShare,
} from "./api";
import { validateNewPassword } from "./password";
import { PasswordInput } from "./password-input";
import { forgetShare, rememberShare, useShareReceipts } from "./receipts";

function expiryLabel(expiresAt: string) {
  return new Date(expiresAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
function errorMessage(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError")
    return "The request took too long. Please try again.";
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export default function ClipboardTool() {
  const location = useLocation();
  const [tab, setTab] = useState(location.hash ? "receive" : "send");
  const [content, setContent] = useState("");
  const [expiresIn, setExpiresIn] = useState<600 | 3600 | 86400>(3600);
  const [includeCode, setIncludeCode] = useState(true);
  const [protectShare, setProtectShare] = useState(false);
  const [password, setPassword] = useState("");
  const receipts = useShareReceipts();
  const [credential, setCredential] = useState(location.hash.slice(1));
  const [received, setReceived] = useState<RetrievedClipboard | null>(null);
  const [sendError, setSendError] = useState("");
  const [receiveError, setReceiveError] = useState("");
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [receivePassword, setReceivePassword] = useState("");
  const receivePasswordRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const receiveController = useRef<AbortController | null>(null);
  const byteCount = clipboardByteLength(content);
  const liveReceipts = receipts.filter((receipt) => Date.parse(receipt.expiresAt) > now);
  const latest = liveReceipts[0];
  const activeReceived = received && Date.parse(received.expiresAt) > now ? received : null;
  const invalidPassword = protectShare ? validateNewPassword(password) : null;

  useEffect(() => {
    if (passwordRequired) receivePasswordRef.current?.focus();
  }, [passwordRequired]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    receiveController.current?.abort();
    setReceiving(false);
    setReceived(null);
    setReceiveError("");
    setPasswordRequired(false);
    setReceivePassword("");
    if (!location.hash) return;
    setTab("receive");
    setCredential(location.hash.slice(1));
    if (!/^#[a-f0-9]{48}$/.test(location.hash)) {
      setReceiveError("This share link is incomplete. Paste a complete link or enter its code.");
      return;
    }
    const controller = new AbortController();
    receiveController.current = controller;
    setReceiving(true);
    const load = async () => {
      try {
        const input = parseCredential(location.hash.slice(1), window.location.origin);
        const result = await retrieveShare(
          input,
          AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        );
        if (!controller.signal.aborted) setReceived(result);
      } catch (error) {
        if (!controller.signal.aborted) {
          if (error instanceof ClipboardPasswordError) setPasswordRequired(true);
          setReceiveError(
            error instanceof ClipboardPasswordError && !error.incorrect ? "" : errorMessage(error),
          );
        }
      } finally {
        if (!controller.signal.aborted) setReceiving(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [location.hash]);

  useEffect(() => () => receiveController.current?.abort(), []);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending || !content || byteCount > MAX_CLIPBOARD_BYTES || invalidPassword) return;
    setSending(true);
    setSendError("");
    try {
      const result = await createShare(
        { content, expiresIn, includeCode },
        protectShare ? password : undefined,
      );
      setPassword("");
      const persisted = rememberShare(result);
      toast.success("Your share is ready.");
      if (!persisted)
        toast.warning(
          "Your browser could not save the deletion receipt. Keep this tab open to delete the share early.",
        );
    } catch (error) {
      setSendError(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  async function receive(event: FormEvent) {
    event.preventDefault();
    receiveController.current?.abort();
    const controller = new AbortController();
    receiveController.current = controller;
    setReceived(null);
    setReceiveError("");
    setReceiving(true);
    try {
      const result = await retrieveShare(
        parseCredential(credential, window.location.origin),
        AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        receivePassword || undefined,
      );
      if (!controller.signal.aborted) {
        setReceived(result);
        setReceivePassword("");
        setPasswordRequired(false);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof ClipboardPasswordError) {
          setPasswordRequired(true);
          receivePasswordRef.current?.focus();
        }
        setReceiveError(
          error instanceof ClipboardPasswordError && !error.incorrect ? "" : errorMessage(error),
        );
      }
    } finally {
      if (!controller.signal.aborted) setReceiving(false);
    }
  }

  async function remove(receipt: CreatedClipboard) {
    setDeleting(receipt.token);
    try {
      await deleteShare(receipt);
      forgetShare(receipt.token);
      toast.success("Share deleted. Its link and code no longer work.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="tool-stack">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="send">
            <Send className="mr-1.5 size-3.5" />
            Send text
          </TabsTrigger>
          <TabsTrigger value="receive">
            <ArrowDownToLine className="mr-1.5 size-3.5" />
            Receive text
          </TabsTrigger>
        </TabsList>
        <TabsContent value="send">
          <div className="tool-grid">
            <ToolPanel
              title="What would you like to share?"
              description="Paste a note, a link, or anything you need on another device."
              footer={
                <span className={byteCount > MAX_CLIPBOARD_BYTES ? "text-destructive" : ""}>
                  {byteCount.toLocaleString()} / 65,536 bytes · UTF-8 text
                </span>
              }
            >
              <form onSubmit={send} className="space-y-5">
                <Textarea
                  aria-label="Text to share"
                  className="tool-editor min-h-64"
                  placeholder="A little something to send across…"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                />
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div className="field-group">
                    <Label htmlFor="share-expiry" className="text-xs">
                      Available for
                    </Label>
                    <Select
                      value={String(expiresIn)}
                      onValueChange={(value) => {
                        const parsed = Number(value);
                        if (parsed === 600 || parsed === 3600 || parsed === 86400)
                          setExpiresIn(parsed);
                      }}
                    >
                      <SelectTrigger id="share-expiry" className="w-40">
                        <Clock3 className="size-3.5" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="600">10 minutes</SelectItem>
                        <SelectItem value="3600">1 hour</SelectItem>
                        <SelectItem value="86400">24 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Switch
                      id="share-code"
                      checked={includeCode}
                      onCheckedChange={setIncludeCode}
                    />
                    <Label htmlFor="share-code" className="text-xs">
                      Include a 6-character code
                    </Label>
                  </div>
                </div>
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="share-password-enabled" className="flex items-center gap-2">
                      <LockKeyhole className="size-4" />
                      Protect with a password
                    </Label>
                    <Switch
                      id="share-password-enabled"
                      checked={protectShare}
                      onCheckedChange={(enabled) => {
                        setProtectShare(enabled);
                        if (!enabled) setPassword("");
                      }}
                    />
                  </div>
                  {protectShare ? (
                    <PasswordInput
                      id="share-password"
                      label="Share password"
                      value={password}
                      onChange={setPassword}
                      minLength={CLIPBOARD_PASSWORD_MIN_LENGTH}
                      hint="Use at least 8 characters. Recipients need this password with the link or code; share it separately."
                    />
                  ) : (
                    <p className="text-xs leading-6 text-muted-foreground">
                      Add a password for private text. Only people with the password can open a
                      protected share.
                    </p>
                  )}
                </div>
                {sendError && (
                  <Alert variant="destructive">
                    <AlertDescription>{sendError}</AlertDescription>
                  </Alert>
                )}
                {byteCount > MAX_CLIPBOARD_BYTES && (
                  <p role="alert" className="text-xs text-destructive">
                    This text is too large. Shorten it to 64 KiB or less.
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={
                    sending ||
                    !content ||
                    byteCount > MAX_CLIPBOARD_BYTES ||
                    Boolean(invalidPassword)
                  }
                  className="w-full"
                >
                  {sending ? <LoaderCircle className="animate-spin" /> : <CloudUpload />}{" "}
                  {sending ? "Creating your share…" : "Create a share"}
                  <ArrowRight className="ml-auto size-4" />
                </Button>
              </form>
            </ToolPanel>
            <ToolPanel
              title={latest ? "Latest active share" : "One small link. Another device."}
              description={
                latest
                  ? "This share contains the text sent when it was created. Editing your text requires a new share."
                  : "Your share link and code will appear here."
              }
            >
              {latest ? (
                <div className="space-y-6">
                  <Badge variant="secondary" className="gap-1.5">
                    <Check className="size-3" /> Share created
                  </Badge>
                  {latest.passwordProtected && (
                    <Badge variant="outline" className="ml-2 gap-1.5">
                      <LockKeyhole className="size-3" />
                      Password protected
                    </Badge>
                  )}
                  <div className="field-group">
                    <Label htmlFor="share-link" className="text-xs">
                      Share link
                    </Label>
                    <Input
                      id="share-link"
                      readOnly
                      value={`${window.location.origin}/tools/clipboard#${latest.token}`}
                      className="font-mono text-xs"
                      onFocus={(event) => event.target.select()}
                    />
                    <div className="mt-1">
                      <CopyButton
                        value={`${window.location.origin}/tools/clipboard#${latest.token}`}
                        label="Copy link"
                      />
                    </div>
                  </div>
                  {latest.code && (
                    <div className="field-group">
                      <Label htmlFor="created-code" className="text-xs">
                        Or use this code
                      </Label>
                      <Input
                        id="created-code"
                        readOnly
                        value={latest.code}
                        className="h-14 bg-muted/40 text-center font-mono text-lg tracking-[0.12em]"
                        onFocus={(event) => event.target.select()}
                      />
                      <div className="mt-1">
                        <CopyButton value={latest.code} label="Copy code" />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock3 className="size-3.5" />
                      Expires {expiryLabel(latest.expiresAt)}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={deleting !== null}
                      onClick={() => void remove(latest)}
                    >
                      <Trash2 className="size-3.5" />
                      {deleting === latest.token ? "Deleting…" : "Delete share"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-80 flex-col items-center justify-center px-5 text-center">
                  <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-accent text-primary">
                    <Link2 className="size-7" strokeWidth={1.4} />
                  </div>
                  <h3 className="font-medium">From here to there.</h3>
                  <p className="mt-2 max-w-60 text-sm leading-7 text-muted-foreground">
                    Create a share, open it on another device, and pick up right where you left off.
                  </p>
                  <div className="mt-7 flex items-center gap-3 text-[10px] font-medium tracking-widest text-muted-foreground">
                    <span>PASTE</span>
                    <ArrowRight className="size-3" />
                    <span>SHARE</span>
                    <ArrowRight className="size-3" />
                    <span>COPY</span>
                  </div>
                </div>
              )}
            </ToolPanel>
          </div>
          {liveReceipts.length > 1 && (
            <div className="mt-5 rounded-xl border bg-card px-5 py-4">
              <h2 className="mb-3 text-sm font-medium">Earlier shares in this tab</h2>
              <div className="space-y-2">
                {liveReceipts.slice(1).map((receipt) => (
                  <div
                    key={receipt.token}
                    className="flex flex-wrap items-center justify-between gap-2 border-t pt-2"
                  >
                    <span className="font-mono text-xs">
                      {receipt.code ?? `${receipt.token.slice(0, 10)}…`}
                      <span className="ml-3 font-sans text-muted-foreground">
                        Expires {expiryLabel(receipt.expiresAt)}
                      </span>
                    </span>
                    <div className="flex gap-2">
                      <CopyButton
                        value={`${window.location.origin}/tools/clipboard#${receipt.token}`}
                        label="Copy link"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deleting !== null}
                        onClick={() => void remove(receipt)}
                        aria-label={`Delete share ${receipt.code ?? receipt.token.slice(0, 10)}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="receive">
          <div className="tool-grid">
            <ToolPanel
              title="Bring your text over"
              description="Enter the code or paste the link from your other device."
            >
              <form onSubmit={receive} className="space-y-5">
                <div className="field-group">
                  <Label htmlFor="receive-credential">Share link or code</Label>
                  <Input
                    id="receive-credential"
                    placeholder="ABC-234"
                    autoComplete="off"
                    spellCheck={false}
                    value={credential}
                    onChange={(event) => {
                      receiveController.current?.abort();
                      setReceiving(false);
                      setCredential(event.target.value);
                      setReceived(null);
                      setReceiveError("");
                      setPasswordRequired(false);
                      setReceivePassword("");
                    }}
                    className="h-12 font-mono"
                  />
                </div>
                {passwordRequired && (
                  <div className="space-y-4">
                    <Alert>
                      <LockKeyhole className="size-4" />
                      <AlertDescription>
                        This share is password protected. Enter its password to open it.
                      </AlertDescription>
                    </Alert>
                    <PasswordInput
                      id="receive-password"
                      label="Share password"
                      value={receivePassword}
                      onChange={(value) => {
                        receiveController.current?.abort();
                        setReceiving(false);
                        setReceived(null);
                        setReceiveError("");
                        setReceivePassword(value);
                      }}
                      inputRef={receivePasswordRef}
                      hint="Passwords are case-sensitive."
                    />
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={
                    receiving || !credential.trim() || (passwordRequired && !receivePassword)
                  }
                  className="w-full"
                >
                  {receiving ? <LoaderCircle className="animate-spin" /> : <ArrowDownToLine />}
                  {receiving
                    ? "Retrieving text…"
                    : passwordRequired
                      ? "Unlock text"
                      : "Get shared text"}
                </Button>
                {receiveError && (
                  <Alert variant="destructive">
                    <AlertDescription>{receiveError}</AlertDescription>
                  </Alert>
                )}
                <p className="text-xs leading-6 text-muted-foreground">
                  Codes ignore letter case, spaces, and hyphens. If a share has expired or been
                  deleted, ask the sender to create a new one.
                </p>
              </form>
            </ToolPanel>
            <ToolPanel
              title="Your shared text"
              actions={<CopyButton value={activeReceived?.content ?? ""} label="Copy text" />}
              footer={
                activeReceived
                  ? `Expires ${expiryLabel(activeReceived.expiresAt)}`
                  : received
                    ? "This share has expired"
                    : "Shared text appears here"
              }
            >
              {activeReceived ? (
                <Textarea
                  readOnly
                  className="tool-editor"
                  aria-label="Received text"
                  value={activeReceived.content}
                />
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <ArrowDownToLine className="size-7" strokeWidth={1.3} />
                  <p className="text-sm">Waiting for something from the other side.</p>
                </div>
              )}
            </ToolPanel>
          </div>
        </TabsContent>
      </Tabs>
      <div className="flex items-start gap-2.5 rounded-xl bg-muted/70 px-4 py-3.5 text-xs leading-6 text-muted-foreground">
        <LockKeyhole className="mt-1 size-3.5 shrink-0" />
        <p>
          Shared text is temporarily stored on our server. Recipients need its link or code and, if
          enabled, its password. You can delete your shares early from this tab; closing it removes
          your deletion receipts.
        </p>
      </div>
    </div>
  );
}
