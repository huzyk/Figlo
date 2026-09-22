import json
import os
import shutil
import threading
import traceback
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

import pymupdf as fitz

APP_NAME = "PolisaZdalna"
STAMP_TEXT = "POLISA ZDALNA"


def app_data_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or str(Path.home())
    p = Path(base) / APP_NAME
    p.mkdir(parents=True, exist_ok=True)
    return p


CONFIG_FILE = app_data_dir() / "config.json"


def unique_rects(rects, tol=2.0):
    out = []
    for r in rects:
        if not any(abs(r.x0-q.x0) < tol and abs(r.y0-q.y0) < tol and abs(r.x1-q.x1) < tol and abs(r.y1-q.y1) < tol for q in out):
            out.append(r)
    return out


def search_any(page, phrases):
    found = []
    for phrase in phrases:
        try:
            found.extend(page.search_for(phrase))
        except Exception:
            pass
    return unique_rects(found)


def drawing_boxes(page):
    boxes = []
    for d in page.get_drawings():
        r = fitz.Rect(d["rect"])
        if r.width >= 70 and 25 <= r.height <= 150:
            boxes.append(r)
    return boxes


def overlap_ratio_x(a, b):
    overlap = max(0.0, min(a.x1, b.x1) - max(a.x0, b.x0))
    return overlap / max(1.0, min(a.width, b.width))


def box_above_label(label, boxes):
    candidates = []
    for b in boxes:
        gap = label.y0 - b.y1
        if -2 <= gap <= 22 and overlap_ratio_x(label, b) >= 0.30:
            score = abs(gap) + 0.03 * abs(b.x0 - label.x0)
            candidates.append((score, b))
    return sorted(candidates, key=lambda x: x[0])[0][1] if candidates else None


def locate_fields(page):
    boxes = drawing_boxes(page)
    insured = []
    for lab in search_any(page, ["Podpis ubezpieczającego"]):
        b = box_above_label(lab, boxes)
        if b is not None and not any(abs(b.x0-q.x0) < 2 and abs(b.y0-q.y0) < 2 for q in insured):
            insured.append(b)

    rep = None
    for lab in search_any(page, [
        "Pieczęć i podpis przedstawiciela PZU SA",
        "Pieczęć i podpis przedstawiciela",
        "podpis przedstawiciela PZU SA",
    ]):
        b = box_above_label(lab, boxes)
        if b is not None:
            rep = b
            break

    insured.sort(key=lambda r: (r.y0, r.x0))
    return insured, rep


def place_centered_text(page, rect, text):
    fontsize = 14.0
    fontname = "hebo"
    max_width = rect.width * 0.90
    while fontsize > 8 and fitz.get_text_length(text, fontname=fontname, fontsize=fontsize) > max_width:
        fontsize -= 0.5
    width = fitz.get_text_length(text, fontname=fontname, fontsize=fontsize)
    x = rect.x0 + (rect.width - width) / 2
    y = rect.y0 + rect.height / 2 + fontsize * 0.35
    page.insert_text((x, y), text, fontname=fontname, fontsize=fontsize, color=(0, 0, 0), overlay=True)


def place_facsimile(page, rect, image_path):
    pad_x = min(8, rect.width * 0.05)
    pad_y = min(6, rect.height * 0.08)
    target = fitz.Rect(rect.x0 + pad_x, rect.y0 + pad_y, rect.x1 - pad_x, rect.y1 - pad_y)
    page.insert_image(target, filename=str(image_path), keep_proportion=True, overlay=True)


def unique_output(outdir, input_path):
    base = Path(input_path).stem + "_POLISA_ZDALNA"
    p = Path(outdir) / (base + ".pdf")
    n = 2
    while p.exists():
        p = Path(outdir) / f"{base}_{n}.pdf"
        n += 1
    return p


def process_pdf(input_pdf, facsimile, outdir):
    src = fitz.open(str(input_pdf))
    if src.page_count < 1:
        src.close()
        raise ValueError("PDF nie zawiera stron.")

    out = fitz.open()
    out.insert_pdf(src, from_page=src.page_count - 1, to_page=src.page_count - 1)
    src.close()
    page = out[0]

    insured, rep = locate_fields(page)
    if len(insured) != 2:
        out.close()
        raise ValueError(f"Nie znaleziono dokładnie 2 pól 'Podpis ubezpieczającego' (znaleziono: {len(insured)}).")
    if rep is None:
        out.close()
        raise ValueError("Nie znaleziono pola 'Pieczęć i podpis przedstawiciela PZU SA'.")

    for r in insured:
        place_centered_text(page, r, STAMP_TEXT)
    place_facsimile(page, rep, facsimile)

    Path(outdir).mkdir(parents=True, exist_ok=True)
    dest = unique_output(outdir, input_pdf)
    out.save(str(dest), garbage=4, deflate=True)
    out.close()
    return dest


class App(tk.Tk):
    BREAKPOINT = 760

    def __init__(self):
        super().__init__()
        self.title("Polisa zdalna – PZU")
        self.geometry("900x620")
        self.minsize(520, 420)
        self.configure(bg="#F4F6F8")

        self.files = []
        self.facsimile_var = tk.StringVar()
        self.output_var = tk.StringVar()
        self.remember_var = tk.BooleanVar(value=True)
        self.status_var = tk.StringVar(value="Dodaj PDF-y lub cały folder.")
        self._compact = None

        self._configure_style()
        self._build_ui()
        self._load_config()
        self.bind("<Configure>", self._on_resize)

    def _configure_style(self):
        style = ttk.Style(self)
        try:
            style.theme_use("vista")
        except Exception:
            pass
        style.configure("TFrame", background="#F4F6F8")
        style.configure("Card.TFrame", background="white")
        style.configure("Title.TLabel", background="white", foreground="#111827", font=("Segoe UI", 17, "bold"))
        style.configure("Sub.TLabel", background="white", foreground="#6B7280", font=("Segoe UI", 9))
        style.configure("Card.TLabel", background="white", foreground="#1F2937", font=("Segoe UI", 9))
        style.configure("Status.TLabel", background="white", foreground="#4B5563", font=("Segoe UI", 9))
        style.configure("Primary.TButton", font=("Segoe UI", 10, "bold"), padding=(16, 9))
        style.configure("TButton", font=("Segoe UI", 9), padding=(9, 6))
        style.configure("TCheckbutton", background="white", font=("Segoe UI", 9))

    def _build_ui(self):
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        header = ttk.Frame(self, style="Card.TFrame", padding=(18, 12))
        header.grid(row=0, column=0, sticky="ew")
        ttk.Label(header, text="Polisa zdalna", style="Title.TLabel").pack(anchor="w")
        ttk.Label(header, text="PZU • ostatnia strona • 2× POLISA ZDALNA • faksymile", style="Sub.TLabel").pack(anchor="w", pady=(2, 0))

        self.outer = ttk.Frame(self, padding=14)
        self.outer.grid(row=1, column=0, sticky="nsew")
        self.outer.grid_rowconfigure(1, weight=1)
        self.outer.grid_columnconfigure(0, weight=1)

        self.toolbar = ttk.Frame(self.outer)
        self.toolbar.grid(row=0, column=0, sticky="ew", pady=(0, 9))
        self.btn_add = ttk.Button(self.toolbar, text="Dodaj PDF-y", command=self.add_pdfs)
        self.btn_folder = ttk.Button(self.toolbar, text="Dodaj folder", command=self.add_folder)
        self.btn_remove = ttk.Button(self.toolbar, text="Usuń zaznaczone", command=self.remove_selected)
        self.btn_clear = ttk.Button(self.toolbar, text="Wyczyść", command=self.clear_files)
        for i, btn in enumerate((self.btn_add, self.btn_folder, self.btn_remove, self.btn_clear)):
            btn.grid(row=0, column=i, padx=(0, 7), sticky="w")

        files_card = ttk.Frame(self.outer, style="Card.TFrame", padding=12)
        files_card.grid(row=1, column=0, sticky="nsew")
        files_card.grid_rowconfigure(1, weight=1)
        files_card.grid_columnconfigure(0, weight=1)

        files_header = ttk.Frame(files_card, style="Card.TFrame")
        files_header.grid(row=0, column=0, sticky="ew", pady=(0, 7))
        files_header.grid_columnconfigure(0, weight=1)
        ttk.Label(files_header, text="Pliki do przetworzenia", style="Card.TLabel", font=("Segoe UI", 10, "bold")).grid(row=0, column=0, sticky="w")
        self.count_label = ttk.Label(files_header, text="0 plików", style="Card.TLabel")
        self.count_label.grid(row=0, column=1, sticky="e")

        list_frame = ttk.Frame(files_card, style="Card.TFrame")
        list_frame.grid(row=1, column=0, sticky="nsew")
        list_frame.grid_rowconfigure(0, weight=1)
        list_frame.grid_columnconfigure(0, weight=1)
        self.listbox = tk.Listbox(list_frame, selectmode=tk.EXTENDED, bd=1, relief="solid", font=("Segoe UI", 9), activestyle="none", height=5)
        scroll = ttk.Scrollbar(list_frame, orient="vertical", command=self.listbox.yview)
        self.listbox.configure(yscrollcommand=scroll.set)
        self.listbox.grid(row=0, column=0, sticky="nsew")
        scroll.grid(row=0, column=1, sticky="ns")

        self.settings = ttk.Frame(self.outer, style="Card.TFrame", padding=12)
        self.settings.grid(row=2, column=0, sticky="ew", pady=(9, 0))
        self.settings.grid_columnconfigure(1, weight=1)

        self.lbl_fac = ttk.Label(self.settings, text="Faksymile", style="Card.TLabel")
        self.ent_fac = ttk.Entry(self.settings, textvariable=self.facsimile_var, state="readonly")
        self.btn_fac = ttk.Button(self.settings, text="Wybierz…", command=self.choose_facsimile)
        self.chk_remember = ttk.Checkbutton(self.settings, text="Zapamiętaj", variable=self.remember_var)

        self.lbl_out = ttk.Label(self.settings, text="Folder wynikowy", style="Card.TLabel")
        self.ent_out = ttk.Entry(self.settings, textvariable=self.output_var)
        self.btn_out = ttk.Button(self.settings, text="Wybierz…", command=self.choose_output)

        self.bottom = ttk.Frame(self.outer, style="Card.TFrame", padding=(12, 9))
        self.bottom.grid(row=3, column=0, sticky="ew", pady=(9, 0))
        self.bottom.grid_columnconfigure(0, weight=1)

        self.status_label = ttk.Label(self.bottom, textvariable=self.status_var, style="Status.TLabel")
        self.progress = ttk.Progressbar(self.bottom, mode="indeterminate")
        self.run_button = ttk.Button(self.bottom, text="PRZETWÓRZ", style="Primary.TButton", command=self.start_processing)

        self.note = ttk.Label(
            self.outer,
            text="Tylko ostatnia strona. Gdy program nie rozpozna pól, nie nanosi niczego i zgłasza błąd.",
            foreground="#6B7280", background="#F4F6F8", font=("Segoe UI", 8),
            wraplength=800, justify="left"
        )
        self.note.grid(row=4, column=0, sticky="ew", pady=(7, 0))

        self._apply_layout(False)

    def _on_resize(self, event):
        if event.widget is not self:
            return
        compact = event.width < self.BREAKPOINT
        if compact != self._compact:
            self._apply_layout(compact)
        self.note.configure(wraplength=max(260, event.width - 50))

    def _apply_layout(self, compact):
        self._compact = compact

        for w in (self.btn_add, self.btn_folder, self.btn_remove, self.btn_clear):
            w.grid_forget()

        if compact:
            self.btn_add.grid(row=0, column=0, padx=(0, 7), pady=(0, 6), sticky="ew")
            self.btn_folder.grid(row=0, column=1, padx=(0, 0), pady=(0, 6), sticky="ew")
            self.btn_remove.grid(row=1, column=0, padx=(0, 7), sticky="ew")
            self.btn_clear.grid(row=1, column=1, sticky="ew")
            self.toolbar.grid_columnconfigure(0, weight=1)
            self.toolbar.grid_columnconfigure(1, weight=1)
            for c in (2, 3):
                self.toolbar.grid_columnconfigure(c, weight=0)
        else:
            for i, btn in enumerate((self.btn_add, self.btn_folder, self.btn_remove, self.btn_clear)):
                btn.grid(row=0, column=i, padx=(0, 7), pady=0, sticky="w")
                self.toolbar.grid_columnconfigure(i, weight=0)

        for w in (self.lbl_fac, self.ent_fac, self.btn_fac, self.chk_remember, self.lbl_out, self.ent_out, self.btn_out):
            w.grid_forget()

        if compact:
            self.settings.grid_columnconfigure(0, weight=1)
            self.settings.grid_columnconfigure(1, weight=0)
            self.lbl_fac.grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 4))
            self.ent_fac.grid(row=1, column=0, sticky="ew", padx=(0, 8))
            self.btn_fac.grid(row=1, column=1, sticky="e")
            self.chk_remember.grid(row=2, column=0, columnspan=2, sticky="w", pady=(5, 9))

            self.lbl_out.grid(row=3, column=0, columnspan=2, sticky="w", pady=(0, 4))
            self.ent_out.grid(row=4, column=0, sticky="ew", padx=(0, 8))
            self.btn_out.grid(row=4, column=1, sticky="e")
        else:
            self.settings.grid_columnconfigure(0, weight=0)
            self.settings.grid_columnconfigure(1, weight=1)
            self.settings.grid_columnconfigure(2, weight=0)
            self.settings.grid_columnconfigure(3, weight=0)
            self.lbl_fac.grid(row=0, column=0, sticky="w", padx=(0, 10), pady=5)
            self.ent_fac.grid(row=0, column=1, sticky="ew", pady=5)
            self.btn_fac.grid(row=0, column=2, padx=(9, 9), pady=5)
            self.chk_remember.grid(row=0, column=3, sticky="w", pady=5)

            self.lbl_out.grid(row=1, column=0, sticky="w", padx=(0, 10), pady=5)
            self.ent_out.grid(row=1, column=1, sticky="ew", pady=5)
            self.btn_out.grid(row=1, column=2, padx=(9, 9), pady=5)

        for w in (self.status_label, self.progress, self.run_button):
            w.grid_forget()

        if compact:
            self.status_label.grid(row=0, column=0, sticky="w")
            self.progress.grid(row=1, column=0, sticky="ew", pady=(6, 8))
            self.run_button.grid(row=2, column=0, sticky="ew")
        else:
            self.status_label.grid(row=0, column=0, sticky="w")
            self.progress.grid(row=1, column=0, sticky="ew", padx=(0, 14), pady=(6, 0))
            self.run_button.grid(row=0, column=1, rowspan=2, sticky="e", padx=(14, 0))

    def _load_config(self):
        try:
            data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            fac = data.get("facsimile", "")
            if fac and Path(fac).exists():
                self.facsimile_var.set(fac)
                self.remember_var.set(True)
            out = data.get("output", "")
            if out:
                self.output_var.set(out)
        except Exception:
            pass

    def _save_config(self):
        if not self.remember_var.get():
            try:
                CONFIG_FILE.unlink(missing_ok=True)
            except Exception:
                pass
            return
        src = Path(self.facsimile_var.get())
        fac_path = str(src)
        if src.exists():
            try:
                dst = app_data_dir() / ("faksymile" + src.suffix.lower())
                if src.resolve() != dst.resolve():
                    shutil.copy2(src, dst)
                fac_path = str(dst)
                self.facsimile_var.set(fac_path)
            except Exception:
                pass
        data = {"facsimile": fac_path, "output": self.output_var.get()}
        CONFIG_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def add_pdfs(self):
        paths = filedialog.askopenfilenames(title="Wybierz polisy PDF", filetypes=[("Pliki PDF", "*.pdf")])
        self._add_paths(paths)

    def add_folder(self):
        folder = filedialog.askdirectory(title="Wybierz folder z polisami PDF")
        if folder:
            self._add_paths(sorted(Path(folder).glob("*.pdf")))

    def _add_paths(self, paths):
        existing = {str(Path(p).resolve()).lower() for p in self.files}
        for p in paths:
            p = Path(p)
            if p.is_file() and p.suffix.lower() == ".pdf":
                key = str(p.resolve()).lower()
                if key not in existing:
                    self.files.append(str(p))
                    existing.add(key)
        if self.files and not self.output_var.get().strip():
            self.output_var.set(str(Path(self.files[0]).parent / "POLISY_GOTOWE"))
        self.refresh_list()

    def refresh_list(self):
        self.listbox.delete(0, tk.END)
        for p in self.files:
            self.listbox.insert(tk.END, p)
        self.count_label.config(text=f"{len(self.files)} plik(ów)")
        self.status_var.set("Gotowe do przetworzenia." if self.files else "Dodaj PDF-y lub cały folder.")

    def remove_selected(self):
        selected = set(self.listbox.curselection())
        self.files = [p for i, p in enumerate(self.files) if i not in selected]
        self.refresh_list()

    def clear_files(self):
        self.files.clear()
        self.refresh_list()

    def choose_facsimile(self):
        p = filedialog.askopenfilename(
            title="Wybierz faksymile",
            filetypes=[("Obrazy", "*.png *.jpg *.jpeg *.bmp *.tif *.tiff"), ("Wszystkie pliki", "*.*")]
        )
        if p:
            self.facsimile_var.set(p)

    def choose_output(self):
        p = filedialog.askdirectory(title="Wybierz folder na gotowe PDF-y")
        if p:
            self.output_var.set(p)

    def start_processing(self):
        if not self.files:
            messagebox.showwarning("Brak plików", "Dodaj przynajmniej jeden PDF.")
            return
        fac = Path(self.facsimile_var.get())
        if not fac.exists():
            messagebox.showwarning("Brak faksymile", "Wybierz plik faksymile.")
            return
        out = self.output_var.get().strip()
        if not out:
            out = str(Path(self.files[0]).parent / "POLISY_GOTOWE")
            self.output_var.set(out)

        try:
            Path(out).mkdir(parents=True, exist_ok=True)
            self._save_config()
        except Exception as e:
            messagebox.showerror("Błąd", f"Nie mogę przygotować folderu wynikowego:\n{e}")
            return

        self.run_button.config(state="disabled")
        self.progress.start(12)
        self.status_var.set("Przetwarzam dokumenty…")
        files = list(self.files)
        threading.Thread(target=self._worker, args=(files, str(fac), out), daemon=True).start()

    def _worker(self, files, fac, out):
        ok = []
        errors = []
        for idx, f in enumerate(files, 1):
            self.after(0, lambda i=idx, n=len(files): self.status_var.set(f"Przetwarzam {i}/{n}…"))
            try:
                dest = process_pdf(f, fac, out)
                ok.append((f, str(dest)))
            except Exception as e:
                errors.append((f, str(e)))
        self.after(0, lambda: self._done(ok, errors, out))

    def _done(self, ok, errors, out):
        self.progress.stop()
        self.run_button.config(state="normal")
        self.status_var.set(f"Gotowe: {len(ok)} z {len(ok)+len(errors)} plików.")
        if errors:
            lines = [f"• {Path(f).name}: {err}" for f, err in errors[:10]]
            more = "" if len(errors) <= 10 else f"\n…i jeszcze {len(errors)-10} błędów."
            messagebox.showwarning(
                "Zakończono z uwagami",
                f"Przetworzono: {len(ok)}\nBłędy: {len(errors)}\n\n" + "\n".join(lines) + more
            )
        else:
            if messagebox.askyesno("Gotowe", f"Przetworzono {len(ok)} plików.\n\nOtworzyć folder wynikowy?"):
                try:
                    os.startfile(out)
                except Exception:
                    pass


def main():
    try:
        app = App()
        app.mainloop()
    except Exception:
        err = traceback.format_exc()
        try:
            log = app_data_dir() / "blad_uruchomienia.txt"
            log.write_text(err, encoding="utf-8")
            messagebox.showerror("Polisa zdalna", f"Program napotkał błąd.\n\nSzczegóły zapisano w:\n{log}")
        except Exception:
            pass


if __name__ == "__main__":
    main()
