"use client"

import * as React from "react"
import { Camera, CircleCheck, Clock, ImageUp, Images, LoaderCircle, MapPin, UserRound } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  formatCoordinates,
  hasRevealingMetadata,
  parseExifDate,
  readPhotoMetadata,
  removePhotoMetadata,
  type PhotoMetadata,
} from "@/registry/default/photo-location-guard/exif"

export * from "@/registry/default/photo-location-guard/exif"

const DEFAULT_LABELS = {
  location: "Location",
  taken: "Taken",
  camera: "Camera serial",
  owner: "Owner name",
  preview: "Hidden preview",
  previewText: "May still show the original, uncropped photo.",
  xmpText: "Location saved by a photo app (XMP).",
  map: "View on map",
}

const btn =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"

/** "Precise to about 1 m: enough to find the building." */
export function describePrecision(metres: number) {
  if (metres <= 15) return `Precise to about ${Math.max(1, Math.round(metres))} m: enough to find the building.`
  if (metres <= 200) return `Precise to about ${Math.round(metres / 10) * 10} m: street level.`
  return `Approximate, within about ${Math.max(1, Math.round(metres / 1000))} km.`
}

const formatBytes = (bytes: number) => (bytes < 1e6 ? `${Math.max(1, Math.round(bytes / 1e3))} KB` : `${(bytes / 1e6).toFixed(1)} MB`)

const osm = (lat: number, lon: number) => `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=17/${lat.toFixed(5)}/${lon.toFixed(5)}`

export interface PhotoLocationGuardProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Controlled photo. */
  value?: File | null
  /** Initial photo when uncontrolled. */
  defaultValue?: File | null
  /** Called with the chosen photo, and with the cleaned copy after "Remove location". */
  onValueChange?: (file: File | null) => void
  /** Optional reverse geocoder, e.g. `(lat, lon) => "Shivajinagar, Pune"`. Without it only coordinates are shown. */
  describeLocation?: (latitude: number, longitude: number) => string | Promise<string>
  /** Map link for the coordinates. Return "" to hide it. */
  mapUrl?: (latitude: number, longitude: number) => string
  /** Locale for the capture time. */
  locale?: string
  /** JPEG quality of the cleaned copy, 0–1. */
  quality?: number
  /** Visible label. */
  label?: string
  /** Button text to choose a photo. */
  chooseLabel?: string
  /** Button text to pick a different photo. */
  changeLabel?: string
  /** Heading over the findings when the photo has a location. */
  title?: string
  /** Heading when there's no location but other details. */
  detailsTitle?: string
  /** Button text to remove location data. */
  removeLabel?: string
  /** Explains what removing does. */
  removeHint?: string
  /** Button text while removing. */
  removingLabel?: string
  /** Shown after location is removed. */
  removedText?: string
  /** Shown when nothing revealing is found. */
  cleanText?: string
  /** Shown when the file can't be read. */
  errorText?: string
  /** Shown for a file type it can't read. */
  unsupportedText?: string
  /** Row names and small texts in the findings list. */
  labels?: Partial<typeof DEFAULT_LABELS>
}

/**
 * Stops a photo from quietly publishing where you live. It reads the JPEG's EXIF
 * and XMP before upload and spells out what would leak: the GPS position with how
 * precise it is, the capture time, the camera's serial number and an embedded
 * preview that can outlive a crop. "Remove location" re-encodes the photo with its
 * orientation baked in, then reads the new file again to prove nothing is left.
 */
export function PhotoLocationGuard({
  value,
  defaultValue = null,
  onValueChange,
  describeLocation,
  mapUrl = osm,
  locale,
  quality = 0.92,
  label = "Photo",
  chooseLabel = "Choose a photo",
  changeLabel = "Change",
  title = "This photo shows where it was taken",
  detailsTitle = "This photo carries hidden details",
  removeLabel = "Remove location",
  removeHint = "Also removes the time, camera details and hidden preview.",
  removingLabel = "Removing…",
  removedText = "Location removed. Checked the new file: nothing left to share.",
  cleanText = "No location or camera details in this photo.",
  errorText = "Couldn't clean this photo. Try exporting it without location instead.",
  unsupportedText = "Only JPEG photos are checked for location.",
  labels: labelOverrides,
  className,
  ...props
}: PhotoLocationGuardProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const file = value === undefined ? inner : value
  const [meta, setMeta] = React.useState<{ file: File; data: PhotoMetadata | null }>()
  const [preview, setPreview] = React.useState<string>()
  const [place, setPlace] = React.useState<string>()
  const [phase, setPhase] = React.useState<"idle" | "removing" | "error">("idle")
  const [cleaned, setCleaned] = React.useState<{ file: File; before: number }>()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const labels = { ...DEFAULT_LABELS, ...labelOverrides }
  const id = React.useId()

  const update = (next: File | null) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  React.useEffect(() => {
    setPhase("idle")
    if (!file) return setPreview(undefined)
    let live = true
    const url = URL.createObjectURL(file)
    setPreview(url)
    void file.arrayBuffer().then((buffer) => live && setMeta({ file, data: readPhotoMetadata(buffer) }))
    return () => {
      live = false
      URL.revokeObjectURL(url)
    }
  }, [file])

  const data = meta?.file === file ? meta.data : undefined
  const gps = data?.gps
  const lat = gps?.latitude
  const lon = gps?.longitude
  React.useEffect(() => {
    setPlace(undefined)
    if (lat === undefined || lon === undefined || !describeLocation) return
    let live = true
    Promise.resolve(describeLocation(lat, lon)).then(
      (text) => live && setPlace(text),
      () => {},
    )
    return () => {
      live = false
    }
  }, [lat, lon, describeLocation])

  const remove = async () => {
    if (!file) return
    setPhase("removing")
    try {
      const next = await removePhotoMetadata(file, file.name, quality)
      setCleaned({ file: next, before: file.size })
      update(next)
    } catch {
      setPhase("error")
    }
  }

  const taken = data?.capturedAt && parseExifDate(data.capturedAt.raw)
  const takenText =
    taken &&
    new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(taken) +
      (data?.capturedAt?.offset ? ` (UTC${data.capturedAt.offset})` : "")
  const serial = [data?.serial, data?.lensSerial && `lens ${data.lensSerial}`].filter(Boolean).join(", ")
  const rows = data
    ? [
        gps && { icon: MapPin, name: labels.location, key: "location" },
        !gps && data.xmpLocation && { icon: MapPin, name: labels.location, text: labels.xmpText, key: "xmp" },
        takenText && { icon: Clock, name: labels.taken, text: takenText, key: "taken" },
        serial && { icon: Camera, name: labels.camera, text: [data.camera, `#${serial}`].filter(Boolean).join(" · "), key: "serial" },
        data.owner && { icon: UserRound, name: labels.owner, text: data.owner, key: "owner" },
        data.thumbnail && { icon: Images, name: labels.preview, text: labels.previewText, key: "preview" },
      ].filter((row): row is { icon: typeof MapPin; name: string; text?: string; key: string } => !!row)
    : []
  const warn = data && hasRevealingMetadata(data) && rows.length > 0
  const justCleaned = cleaned?.file === file && data !== undefined && !warn
  const href = gps ? mapUrl(gps.latitude, gps.longitude) : ""

  return (
    <div data-slot="photo-location-guard" className={cn("grid w-full max-w-md gap-1.5 text-sm", className)} {...props}>
      <style>{`@keyframes cui-photo-location-guard-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`}</style>
      <label htmlFor={id} className="w-fit font-medium">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/*"
        className="sr-only"
        onChange={(event) => {
          setCleaned(undefined)
          update(event.target.files?.[0] ?? null)
          event.target.value = ""
        }}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border bg-background p-2 shadow-xs dark:bg-input/30">
          {preview && <img src={preview} alt="" className="size-12 shrink-0 rounded-md object-cover" />}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {justCleaned && cleaned ? `${formatBytes(cleaned.before)} → ${formatBytes(file.size)}` : formatBytes(file.size)}
            </p>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} className={cn(btn, "border bg-background hover:bg-accent dark:bg-transparent")}>
            {changeLabel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-6 text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ImageUp aria-hidden className="size-5" />
          <span className="font-medium text-foreground">{chooseLabel}</span>
        </button>
      )}

      <div aria-live="polite" className="mt-1.5 empty:hidden">
        {file && data === null && <p className="text-xs text-muted-foreground">{unsupportedText}</p>}
        {warn && (
          <section
            aria-label={gps || data.xmpLocation ? title : detailsTitle}
            className="@container rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-950 dark:text-amber-50"
          >
            <h3 className="flex items-start gap-2 font-medium">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              {gps || data.xmpLocation ? title : detailsTitle}
            </h3>
            <dl className="mt-2 grid gap-x-3 gap-y-0.5 text-xs @sm:grid-cols-[auto_1fr] @sm:gap-y-1.5">
              {rows.map(({ icon: Icon, name, text, key }) => (
                <React.Fragment key={key}>
                  <dt className="mt-1 flex items-center gap-1.5 text-amber-900/75 dark:text-amber-100/75">
                    <Icon aria-hidden className="size-3.5" />
                    {name}
                  </dt>
                  <dd className="min-w-0 pl-5 @sm:mt-1 @sm:pl-0">
                    {key === "location" && gps ? (
                      <>
                        {place && <span className="font-medium">{place} · </span>}
                        <span className="font-medium whitespace-nowrap tabular-nums">{formatCoordinates(gps.latitude, gps.longitude)}</span>
                        {href && (
                          <a href={href} target="_blank" rel="noreferrer" className="ml-1.5 rounded-sm whitespace-nowrap underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                            {labels.map}
                          </a>
                        )}
                        <span className="block text-amber-900/75 dark:text-amber-100/75">{describePrecision(gps.precision)}</span>
                      </>
                    ) : (
                      <span className="break-words">{text}</span>
                    )}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <button
                type="button"
                onClick={() => void remove()}
                disabled={phase === "removing"}
                aria-busy={phase === "removing" || undefined}
                className={cn(btn, "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300")}
              >
                {phase === "removing" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                {phase === "removing" ? removingLabel : removeLabel}
              </button>
              <span className="text-xs text-amber-900/75 dark:text-amber-100/75">{removeHint}</span>
            </div>
            {phase === "error" && (
              <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
                {errorText}
              </p>
            )}
          </section>
        )}
        {data && !warn && (
          <p
            className={cn(
              "flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400",
              justCleaned && "motion-safe:animate-[cui-photo-location-guard-in_300ms_ease-out]",
            )}
          >
            <CircleCheck aria-hidden className="size-3.5 shrink-0" />
            {justCleaned ? removedText : cleanText}
          </p>
        )}
      </div>
    </div>
  )
}
