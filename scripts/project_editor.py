#!/usr/bin/env python3
"""
vainie project editor — tiny GUI to create/edit vainie.json files.

usage:
    python3 scripts/project_editor.py
    python3 scripts/project_editor.py --root "/mnt/PLIKI/Dokumenty HDD/PROJECTS"

opens a window where you can:
  * pick a project folder inside one of the 4 status dirs
  * edit/create its vainie.json (name, tagline, description, tech, cover)
  * pick a cover image (copied into the project dir if outside)
  * save

no external deps required — uses tkinter (stdlib).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from tkinter import (
    Tk, ttk, StringVar, BooleanVar, filedialog, messagebox, END, Text,
    Frame, Label, Button, Entry, Scrollbar, Listbox, SINGLE,
)

DEFAULT_ROOT = "/mnt/PLIKI/Dokumenty HDD/PROJECTS"
STATUS_DIRS = ["Finished", "In progress", "Left out", "Planned"]
JSON_NAME = "vainie.json"
COVER_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"}


@dataclass
class ProjectData:
    name: str = ""
    tagline: str = ""
    description: str = ""
    tech: list[str] = field(default_factory=list)
    cover: str | None = None

    def to_json(self) -> str:
        d = asdict(self)
        if not d.get("cover"):
            d.pop("cover", None)
        return json.dumps(d, indent=2, ensure_ascii=False) + "\n"

    @classmethod
    def from_path(cls, p: Path) -> "ProjectData":
        if not p.exists():
            return cls()
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return cls()
        return cls(
            name=data.get("name", ""),
            tagline=data.get("tagline", ""),
            description=data.get("description", ""),
            tech=list(data.get("tech", [])),
            cover=data.get("cover") or None,
        )


class App:
    def __init__(self, root: Tk, base: Path):
        self.root = root
        self.base = base
        root.title("vainie — project editor")
        root.geometry("900x680")

        self._build_ui()
        self._refresh_project_list()

    # ---------- UI setup ----------
    def _build_ui(self):
        # top bar
        top = Frame(self.root, padx=12, pady=10)
        top.pack(fill="x")

        Label(top, text="root:", font=("TkDefaultFont", 9, "bold")).pack(side="left")
        self.root_var = StringVar(value=str(self.base))
        Entry(top, textvariable=self.root_var, width=52).pack(side="left", padx=6)
        Button(top, text="change…", command=self._pick_root).pack(side="left")
        Button(top, text="↻ refresh", command=self._refresh_project_list).pack(side="left", padx=6)
        Button(top, text="+ new", command=self._new_project).pack(side="right")

        # paned split
        paned = ttk.Panedwindow(self.root, orient="horizontal")
        paned.pack(fill="both", expand=True, padx=12, pady=6)

        # left: project list
        left = Frame(paned)
        paned.add(left, weight=1)

        Label(left, text="projects", font=("TkDefaultFont", 9, "bold")).pack(anchor="w")
        list_frame = Frame(left)
        list_frame.pack(fill="both", expand=True)

        self.listbox = Listbox(list_frame, selectmode=SINGLE, activestyle="dotbox", width=36)
        self.listbox.pack(side="left", fill="both", expand=True)
        lsb = Scrollbar(list_frame, orient="vertical", command=self.listbox.yview)
        lsb.pack(side="right", fill="y")
        self.listbox.config(yscrollcommand=lsb.set)
        self.listbox.bind("<<ListboxSelect>>", lambda _e: self._on_select())

        # right: editor
        right = Frame(paned, padx=12)
        paned.add(right, weight=3)

        # selected folder label
        self.selected_folder_var = StringVar(value="")
        Label(right, textvariable=self.selected_folder_var,
              foreground="#555", font=("TkDefaultFont", 9, "italic")).pack(anchor="w", pady=(0, 6))

        # form
        form = Frame(right)
        form.pack(fill="x", expand=False)

        self.name_var = StringVar()
        self.tagline_var = StringVar()
        self.cover_var = StringVar()

        self._labeled(form, "name",    Entry(form, textvariable=self.name_var, width=60))
        self._labeled(form, "tagline", Entry(form, textvariable=self.tagline_var, width=60))

        Label(form, text="description", width=14, anchor="w").grid(row=2, column=0, sticky="nw", pady=3)
        self.desc_text = Text(form, height=8, width=60, wrap="word")
        self.desc_text.grid(row=2, column=1, sticky="we", pady=3)

        # tech (comma-separated)
        self.tech_var = StringVar()
        self._labeled(form, "tech",     Entry(form, textvariable=self.tech_var, width=60), row=3)
        Label(form, text="comma-separated, e.g. Unity, C#, raylib",
              foreground="#888", font=("TkDefaultFont", 8)).grid(row=4, column=1, sticky="w")

        # cover
        cover_row = Frame(form)
        cover_row.grid(row=5, column=0, columnspan=2, sticky="we", pady=(10, 3))
        Label(cover_row, text="cover", width=14, anchor="w").pack(side="left")
        Entry(cover_row, textvariable=self.cover_var, width=42).pack(side="left", expand=True, fill="x")
        Button(cover_row, text="pick file…", command=self._pick_cover).pack(side="left", padx=6)
        Button(cover_row, text="clear", command=lambda: self.cover_var.set("")).pack(side="left")

        form.columnconfigure(1, weight=1)

        # buttons row
        btns = Frame(right, pady=12)
        btns.pack(fill="x")
        Button(btns, text="save", command=self._save, width=12).pack(side="left")
        Button(btns, text="open folder", command=self._open_folder).pack(side="left", padx=6)
        Button(btns, text="delete vainie.json", command=self._delete_json).pack(side="right")

        # status bar
        self.status_var = StringVar(value="ready.")
        Label(self.root, textvariable=self.status_var, foreground="#555",
              anchor="w", padx=12, pady=6, relief="sunken").pack(side="bottom", fill="x")

        self.current_dir: Path | None = None

    def _labeled(self, parent, label, widget, row=None):
        if row is None:
            row = len(parent.grid_slaves()) // 2
        Label(parent, text=label, width=14, anchor="w").grid(row=row, column=0, sticky="w", pady=3)
        widget.grid(row=row, column=1, sticky="we", pady=3)

    # ---------- actions ----------
    def _pick_root(self):
        d = filedialog.askdirectory(initialdir=self.base, mustexist=True,
                                    title="pick projects root")
        if d:
            self.base = Path(d)
            self.root_var.set(str(self.base))
            self._refresh_project_list()

    def _refresh_project_list(self):
        self.listbox.delete(0, END)
        self.entries: list[tuple[str, Path]] = []
        if not self.base.exists():
            self.status_var.set(f"root does not exist: {self.base}")
            return
        for status in STATUS_DIRS:
            status_dir = self.base / status
            if not status_dir.is_dir():
                continue
            for proj in sorted(status_dir.iterdir()):
                if not proj.is_dir():
                    continue
                has_json = (proj / JSON_NAME).exists()
                mark = "●" if has_json else "○"
                label = f"{mark}  {status}/{proj.name}"
                self.listbox.insert(END, label)
                self.entries.append((label, proj))
        self.status_var.set(f"{len(self.entries)} projects found under {self.base}")

    def _on_select(self):
        sel = self.listbox.curselection()
        if not sel:
            return
        _label, path = self.entries[sel[0]]
        self._load_into_form(path)

    def _load_into_form(self, proj_dir: Path):
        self.current_dir = proj_dir
        rel_to_root = proj_dir.relative_to(self.base)
        self.selected_folder_var.set(f"→ {rel_to_root}")
        data = ProjectData.from_path(proj_dir / JSON_NAME)
        self.name_var.set(data.name or proj_dir.name)
        self.tagline_var.set(data.tagline)
        self.desc_text.delete("1.0", END)
        self.desc_text.insert("1.0", data.description)
        self.tech_var.set(", ".join(data.tech))
        self.cover_var.set(data.cover or "")

    def _new_project(self):
        # just show a picker to select any subdir of base
        d = filedialog.askdirectory(initialdir=str(self.base), title="pick project folder")
        if not d:
            return
        p = Path(d)
        try:
            p.relative_to(self.base)
        except ValueError:
            messagebox.showerror("nope", "folder must be inside the root.")
            return
        self._load_into_form(p)

    def _pick_cover(self):
        if not self.current_dir:
            messagebox.showinfo("pick a project first", "select a project from the left first.")
            return
        f = filedialog.askopenfilename(
            initialdir=self.current_dir,
            title="pick cover image",
            filetypes=[("image files", " ".join(f"*{e}" for e in sorted(COVER_EXTS)))],
        )
        if not f:
            return
        src = Path(f)
        if src.suffix.lower() not in COVER_EXTS:
            messagebox.showerror("bad file", "not an image extension i recognize.")
            return
        # if image is outside project dir, copy it in
        try:
            rel = src.relative_to(self.current_dir)
            self.cover_var.set(str(rel))
            return
        except ValueError:
            pass
        dst = self.current_dir / src.name
        if dst.exists():
            if not messagebox.askyesno("overwrite?", f"{dst.name} already exists. overwrite?"):
                return
        try:
            shutil.copy2(src, dst)
        except Exception as e:
            messagebox.showerror("copy failed", str(e))
            return
        self.cover_var.set(dst.name)
        self.status_var.set(f"copied cover → {dst}")

    def _save(self):
        if not self.current_dir:
            messagebox.showwarning("nothing picked", "select a project first.")
            return
        name = self.name_var.get().strip()
        if not name:
            messagebox.showerror("missing name", "the 'name' field is required.")
            return
        tech = [t.strip() for t in self.tech_var.get().split(",") if t.strip()]
        data = ProjectData(
            name=name,
            tagline=self.tagline_var.get().strip(),
            description=self.desc_text.get("1.0", END).strip(),
            tech=tech,
            cover=self.cover_var.get().strip() or None,
        )
        path = self.current_dir / JSON_NAME
        try:
            path.write_text(data.to_json(), encoding="utf-8")
        except Exception as e:
            messagebox.showerror("save failed", str(e))
            return
        self.status_var.set(f"saved → {path}")
        self._refresh_project_list()

    def _open_folder(self):
        if not self.current_dir:
            return
        os.system(f"xdg-open '{self.current_dir}' &")

    def _delete_json(self):
        if not self.current_dir:
            return
        p = self.current_dir / JSON_NAME
        if not p.exists():
            self.status_var.set("nothing to delete.")
            return
        if not messagebox.askyesno("delete?", f"delete {p.name}? the cover file stays."):
            return
        p.unlink()
        self.status_var.set(f"removed {p}")
        self._refresh_project_list()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=DEFAULT_ROOT, help="projects root directory")
    args = ap.parse_args()

    base = Path(args.root)
    root = Tk()
    App(root, base)
    root.mainloop()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
