"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "@/router/link";
import { motion } from "framer-motion";
import { Camera, Check, Sparkles, Upload, Wand2 } from "lucide-react";
import { toast } from "@/components/Toasts";
import { api } from "@/lib/api";
import { buildProfileAvatar, useAuth, type User } from "@/lib/store";

const MAX_BIO = 180;
const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PROFILE_PHOTO_DIMENSION = 512;

async function optimizeProfilePhoto(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_PROFILE_PHOTO_DIMENSION / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("The selected image could not be compressed.")),
        "image/webp",
        0.82,
      );
    });

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("The compressed image could not be read."));
      reader.onerror = () => reject(new Error("The compressed image could not be read."));
      reader.readAsDataURL(blob);
    });
  } finally {
    image.close();
  }
}

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bio, setBio] = useState(user?.bio ?? "Building momentum, one lesson at a time.");
  const [avatar, setAvatar] = useState(user?.avatar ?? buildProfileAvatar(user?.name ?? "Student"));
  const [saving, setSaving] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    let active = true;
    void api.get<{ user: User }>("/api/v1/auth/me").then((res) => {
      if (!active) return;
      if (!res.success) {
        toast.err(res.message);
        return;
      }
      setUser(res.data.user);
      setBio(res.data.user.bio ?? "Building momentum, one lesson at a time.");
      setAvatar(res.data.user.avatar ?? buildProfileAvatar(res.data.user.name));
      setHasUnsavedChanges(false);
    });
    return () => { active = false; };
  }, [setUser]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedChanges]);

  if (!user) return null;

  const initials = user.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "ST";

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      toast.err("Choose a PNG, JPEG, WEBP, or GIF image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      toast.err("Profile photos must be 10 MB or smaller.");
      event.target.value = "";
      return;
    }
    event.target.value = "";
    setProcessingImage(true);
    try {
      const optimized = await optimizeProfilePhoto(file);
      setAvatar(optimized);
      setHasUnsavedChanges(true);
      toast.ok("Photo optimized and ready to save.");
    } catch (error) {
      toast.err(error instanceof Error ? error.message : "The selected image could not be processed.");
    } finally {
      setProcessingImage(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await api.patch<{ user: User }>("/api/v1/profile", { bio, avatar });
    setSaving(false);
    if (!res.success) {
      toast.err(res.message);
      return;
    }
    setUser(res.data.user);
    setBio(res.data.user.bio ?? bio);
    setAvatar(res.data.user.avatar ?? avatar);
    setHasUnsavedChanges(false);
    toast.ok("Profile saved — your orbit is looking sharper.");
  };

  const handleReset = async () => {
    setSaving(true);
    const defaultAvatar = buildProfileAvatar(user.name);
    const defaultBio = "Building momentum, one lesson at a time.";
    const res = await api.patch<{ user: User }>("/api/v1/profile", { bio: defaultBio, avatar: defaultAvatar });
    setSaving(false);
    if (!res.success) {
      toast.err(res.message);
      return;
    }
    setAvatar(defaultAvatar);
    setBio(defaultBio);
    setUser(res.data.user);
    setHasUnsavedChanges(false);
    toast.info("Profile reset to your default orbit look.");
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-[26px] border border-line bg-[radial-gradient(circle_at_top_left,_rgba(91,155,216,0.22),transparent_35%),linear-gradient(135deg,var(--surface),var(--raised))] p-6 md:p-8">
        <div className="glow-blob left-1/2 top-6 h-56 w-56 bg-primary/15" />
        <div className="glow-blob bottom-0 right-0 h-56 w-56 bg-mint/10" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={avatar}
                alt={`${user.name} profile`}
                className="h-24 w-24 rounded-full border-4 border-surface object-cover shadow-[0_22px_44px_-18px_rgba(19,74,124,0.7)]"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-primary shadow-lg transition hover:scale-[1.03]"
                aria-label="Upload profile picture"
              >
                <Camera size={16} />
              </button>
            </div>

            <div>
              <div className="tag mb-2"><Sparkles size={11} /> profile spotlight</div>
              <h1 className="display text-3xl md:text-4xl font-bold tracking-tight">{user.name}</h1>
              <p className="text-muted text-sm mt-1">Level {user.level} learner · {user.xp.toLocaleString()} XP earned</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-primary" disabled={saving || processingImage}>
              <Upload size={15} /> {processingImage ? "Optimizing…" : "Upload photo"}
            </button>
            <button type="button" onClick={handleReset} className="btn btn-ghost" disabled={saving || processingImage}>
              <Wand2 size={15} /> Reset style
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5 md:p-6"
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="eyebrow">About you</p>
              <h2 className="display text-2xl font-bold mt-2">A short bio that feels like your orbit.</h2>
            </div>
            <span className="tag">{bio.length}/{MAX_BIO}</span>
          </div>

          <textarea
            value={bio}
            onChange={(event) => {
              setBio(event.target.value.slice(0, MAX_BIO));
              setHasUnsavedChanges(true);
            }}
            rows={5}
            className="input resize-none"
            placeholder="I turn confusion into momentum by shipping tiny wins, testing ideas fast, and learning in public."
            disabled={saving}
          />

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-muted text-sm" aria-live="polite">
              {hasUnsavedChanges
                ? "Photo preview only — save your profile to store it in your account."
                : "Your bio and profile photo are saved to your account and will still be there after you log out."}
            </p>
            <button type="button" onClick={handleSave} className="btn btn-mint" disabled={saving || processingImage || !hasUnsavedChanges}>
              <Check size={15} /> {saving ? "Saving" : processingImage ? "Optimizing photo" : "Save profile"}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleImageSelect}
            className="hidden"
            disabled={saving || processingImage}
          />
        </motion.section>

        <motion.aside
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="card p-5 md:p-6"
        >
          <p className="eyebrow">Preview</p>
          <div className="mt-4 rounded-[22px] border border-line bg-[radial-gradient(circle_at_top,_rgba(19,74,124,0.14),transparent_40%),linear-gradient(180deg,var(--surface),var(--raised))] p-4">
            <div className="flex items-center gap-3">
              <img src={avatar} alt="Preview" className="h-14 w-14 rounded-full object-cover border border-line" />
              <div>
                <p className="font-semibold text-base">{user.name}</p>
                <p className="font-mono text-[11px] text-muted">{initials} · active learner</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-line bg-surface/80 p-3">
              <p className="text-[12px] uppercase tracking-[0.2em] text-muted">Current vibe</p>
              <p className="mt-2 text-sm leading-6 text-text">{bio || "Building momentum, one lesson at a time."}</p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["XP", user.xp.toLocaleString()],
                ["Level", String(user.level)],
                ["Streak", "3d"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-line bg-surface/70 p-2">
                  <p className="font-mono text-[10px] text-muted">{label}</p>
                  <p className="mt-1 text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.aside>
      </div>

      <div className="card p-5 md:p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="eyebrow">Quick wins</p>
            <h3 className="display text-2xl font-bold mt-2">Make the profile feel like you, not a template.</h3>
          </div>
          <Link href="/dashboard" className="link text-sm font-medium">Back to dashboard</Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            "Add a photo that feels like your real study style.",
            "Keep the bio short, specific, and memorable.",
            "Use the profile as your visible identity across the platform.",
          ].map((tip) => (
            <div key={tip} className="rounded-2xl border border-line bg-raised/80 p-4 text-sm text-muted">
              {tip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
