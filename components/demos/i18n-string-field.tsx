"use client"

import { I18nStringField } from "@/registry/default/i18n-string-field/i18n-string-field"

export function Demo() {
  return (
    <div className="grid w-full max-w-md gap-6">
      <I18nStringField
        locale="pl"
        source="{count, plural, one {<b>#</b> file shared with {name}} other {<b>#</b> files shared with {name}}}"
        defaultValue="{count, plural, one {<b>#</b> plik dla {imie}} other {<b>#</b> plików dla {imie}}}"
        rows={3}
      />
      <I18nStringField locale="de" source="Save changes" defaultValue="Änderungen speichern" maxLength={14} rows={1} />
    </div>
  )
}
