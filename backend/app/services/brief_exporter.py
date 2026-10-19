"""Export service for Packaging Briefs generating DOCX and PDF documents."""

from pathlib import Path
from datetime import datetime
import logging
from typing import Optional

from app.models.brief import PackagingBrief
from app.config import settings

logger = logging.getLogger(__name__)


def export_to_docx(brief: PackagingBrief, output_path: Optional[Path] = None) -> str:
    """Exports a PackagingBrief to a formatted Word document (.docx).

    Includes title header, section tables, issues register,
    open questions, and an agency sign-off proof block.
    """
    import docx
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    doc = docx.Document()

    # Set 0.75 in margins
    for s in doc.sections:
        s.top_margin = Inches(0.75)
        s.bottom_margin = Inches(0.75)
        s.left_margin = Inches(0.75)
        s.right_margin = Inches(0.75)

    # Document Header / Title
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_p.add_run("BRIEFFORGE PACKAGING DESIGN BRIEF")
    title_run.font.name = "Arial"
    title_run.font.size = Pt(20)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(30, 58, 138)  # Deep Navy

    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = sub_p.add_run(f"Product: {brief.product_name}")
    sub_run.font.name = "Arial"
    sub_run.font.size = Pt(14)
    sub_run.font.bold = True
    sub_run.font.color.rgb = RGBColor(51, 65, 85)

    # Metadata Line
    meta_p = doc.add_paragraph()
    meta_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta_run = meta_p.add_run(
        f"Session ID: {brief.session_id}   |   Date: {brief.created_at[:10]}   |   Status: {brief.status.upper()}"
    )
    meta_run.font.size = Pt(9.5)
    meta_run.font.italic = True
    meta_run.font.color.rgb = RGBColor(100, 116, 139)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # Issues Summary Box
    summary = brief.issues_summary
    sum_p = doc.add_paragraph()
    sum_run = sum_p.add_run(
        f"Validation Summary:  [ Critical Issues: {summary.get('critical', 0)} ]   "
        f"[ Warnings: {summary.get('warning', 0)} ]   [ Info / Assumptions: {summary.get('info', 0)} ]"
    )
    sum_run.font.bold = True
    sum_run.font.size = Pt(10)
    if summary.get("critical", 0) > 0:
        sum_run.font.color.rgb = RGBColor(185, 28, 28)  # Red
    else:
        sum_run.font.color.rgb = RGBColor(21, 128, 61)  # Green

    # Loop through all Brief Sections
    for section in brief.sections:
        h = doc.add_heading(section.section_name, level=1)
        h.paragraph_format.space_before = Pt(14)
        h.paragraph_format.space_after = Pt(4)

        # Create Table for Section Fields
        table = doc.add_table(rows=1, cols=5)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False

        headers = ["Field Name", "Specification / Value", "Source", "Status", "Notes & Discrepancies"]
        hdr_cells = table.rows[0].cells
        for idx, text in enumerate(headers):
            hdr_cells[idx].text = text
            p = hdr_cells[idx].paragraphs[0]
            p.runs[0].font.bold = True
            p.runs[0].font.size = Pt(9.5)
            p.runs[0].font.color.rgb = RGBColor(255, 255, 255)

            # Header shading (Navy)
            shd = OxmlElement('w:shd')
            shd.set(qn('w:val'), 'clear')
            shd.set(qn('w:color'), 'auto')
            shd.set(qn('w:fill'), '1E3A8A')
            hdr_cells[idx]._tc.get_or_add_tcPr().append(shd)

        for field in section.fields:
            row_cells = table.add_row().cells
            val_display = str(field.user_override if field.user_override is not None else field.value or "")
            issues_display = "; ".join(field.issues) if field.issues else ""

            row_cells[0].text = field.label or field.field_name
            row_cells[1].text = val_display
            row_cells[2].text = field.source
            row_cells[3].text = field.status.upper()
            row_cells[4].text = issues_display

            for cell in row_cells:
                for p in cell.paragraphs:
                    p.paragraph_format.space_after = Pt(2)
                    p.paragraph_format.space_before = Pt(2)
                    for run in p.runs:
                        run.font.size = Pt(8.5)

            # Color code status cell text
            status_para = row_cells[3].paragraphs[0]
            if status_para.runs:
                if field.status == "conflicting" or field.status == "flagged":
                    status_para.runs[0].font.color.rgb = RGBColor(185, 28, 28)
                    status_para.runs[0].font.bold = True
                elif field.status == "missing":
                    status_para.runs[0].font.color.rgb = RGBColor(180, 83, 9)
                    status_para.runs[0].font.bold = True
                else:
                    status_para.runs[0].font.color.rgb = RGBColor(21, 128, 61)

        doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # Open Questions Section
    if brief.open_questions:
        q_h = doc.add_heading("Open Questions for Brand & Prepress Team", level=1)
        q_h.paragraph_format.space_before = Pt(16)
        for q in brief.open_questions:
            doc.add_paragraph(f"•  {q}", style="List Bullet")

    # Agency Sign-Off & Proof Table
    doc.add_page_break()
    so_h = doc.add_heading("Prepress Verification & Proof Sign-Off Block", level=1)
    so_h.paragraph_format.space_before = Pt(14)
    so_p = doc.add_paragraph(
        "By signing below, the designated stakeholders verify that the content above reflects "
        "the final approved packaging copy, dimensions, and legal requirements prior to plate making."
    )
    so_p.paragraph_format.space_after = Pt(10)

    so_table = doc.add_table(rows=1, cols=5)
    so_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    so_headers = ["Stakeholder Role", "Approver Name", "Approval Status", "Date", "Signature"]
    for idx, text in enumerate(so_headers):
        so_table.rows[0].cells[idx].text = text
        p = so_table.rows[0].cells[idx].paragraphs[0]
        p.runs[0].font.bold = True
        p.runs[0].font.size = Pt(9.5)

    roles = [
        "Brand Marketing Lead",
        "Packaging Engineer / Prepress",
        "Regulatory & Legal Compliance",
        "Quality Assurance Manager",
    ]
    for role in roles:
        r_cells = so_table.add_row().cells
        r_cells[0].text = role
        r_cells[1].text = ""
        r_cells[2].text = "[   ] Approved  [   ] Rejected"
        r_cells[3].text = ""
        r_cells[4].text = ""
        for cell in r_cells:
            for p in cell.paragraphs:
                p.paragraph_format.space_after = Pt(6)
                p.paragraph_format.space_before = Pt(6)

    # Save Word Document
    dest_path = output_path or (settings.EXPORT_DIR / f"{brief.session_id}_brief.docx")
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(dest_path))
    logger.info(f"Generated DOCX brief at {dest_path}")
    return str(dest_path)


def export_to_pdf(brief: PackagingBrief, output_path: Optional[Path] = None) -> str:
    """Exports a PackagingBrief to a professional PDF document using reportlab."""
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
        Table,
        TableStyle,
        KeepTogether,
        HRFlowable,
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors

    dest_path = output_path or (settings.EXPORT_DIR / f"{brief.session_id}_brief.pdf")
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(dest_path),
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1E3A8A"),
        alignment=1,  # Center
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#334155"),
        alignment=1,
    )

    meta_style = ParagraphStyle(
        "DocMeta",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#64748B"),
        alignment=1,
    )

    h1_style = ParagraphStyle(
        "SectionH1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#1E3A8A"),
        spaceBefore=10,
        spaceAfter=4,
    )

    cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )

    cell_bold_style = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )

    cell_hdr_style = ParagraphStyle(
        "TableHdr",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )

    story = []

    # Title & Metadata
    story.append(Paragraph("BRIEFFORGE PACKAGING DESIGN BRIEF", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Product: {brief.product_name}", subtitle_style))
    story.append(Spacer(1, 4))
    meta_line = (
        f"Session ID: {brief.session_id}   |   Date: {brief.created_at[:10]}   |   Status: {brief.status.upper()}"
    )
    story.append(Paragraph(meta_line, meta_style))
    story.append(Spacer(1, 10))

    # Executive Summary Banner
    summary = brief.issues_summary
    crit_count = summary.get("critical", 0)
    warn_count = summary.get("warning", 0)
    info_count = summary.get("info", 0)

    summary_text = (
        f"<b>Validation Summary:</b> Critical Issues: {crit_count}  |  "
        f"Warnings: {warn_count}  |  Informational: {info_count}"
    )
    summary_bg = colors.HexColor("#FEE2E2") if crit_count > 0 else colors.HexColor("#DCFCE7")
    summary_color = colors.HexColor("#991B1B") if crit_count > 0 else colors.HexColor("#166534")

    sum_p_style = ParagraphStyle(
        "SumBanner",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=summary_color,
        alignment=1,
    )
    sum_table = Table([[Paragraph(summary_text, sum_p_style)]], colWidths=[540])
    sum_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), summary_bg),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    story.append(sum_table)
    story.append(Spacer(1, 10))

    # Sections Tables
    col_widths = [110, 160, 110, 60, 100]

    for section in brief.sections:
        story.append(Paragraph(section.section_name, h1_style))

        table_data = [
            [
                Paragraph("Field Name", cell_hdr_style),
                Paragraph("Specification / Value", cell_hdr_style),
                Paragraph("Source", cell_hdr_style),
                Paragraph("Status", cell_hdr_style),
                Paragraph("Notes & Issues", cell_hdr_style),
            ]
        ]

        for field in section.fields:
            val = str(field.user_override if field.user_override is not None else field.value or "")
            issues_txt = "; ".join(field.issues) if field.issues else "-"

            status_style = ParagraphStyle(
                "StatusCell",
                parent=cell_style,
                fontName="Helvetica-Bold",
                textColor=(
                    colors.HexColor("#B91C1C")
                    if field.status in ["conflicting", "flagged"]
                    else (colors.HexColor("#B45309") if field.status == "missing" else colors.HexColor("#15803D"))
                ),
            )

            row = [
                Paragraph(field.label or field.field_name, cell_bold_style),
                Paragraph(val, cell_style),
                Paragraph(field.source, cell_style),
                Paragraph(field.status.upper(), status_style),
                Paragraph(issues_txt, cell_style),
            ]
            table_data.append(row)

        t = Table(table_data, colWidths=col_widths, repeatRows=1)
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ]
            )
        )
        story.append(t)
        story.append(Spacer(1, 8))

    # Open Questions
    if brief.open_questions:
        story.append(Spacer(1, 6))
        story.append(Paragraph("Open Questions for Client / Prepress Team", h1_style))
        for q in brief.open_questions:
            story.append(Paragraph(f"• {q}", cell_style))
            story.append(Spacer(1, 2))

    # Proof Sign-Off Block
    story.append(Spacer(1, 10))
    story.append(Paragraph("Agency Sign-Off & Verification Block", h1_style))
    so_data = [
        [
            Paragraph("Stakeholder Role", cell_hdr_style),
            Paragraph("Approver Name", cell_hdr_style),
            Paragraph("Approval Status", cell_hdr_style),
            Paragraph("Date", cell_hdr_style),
            Paragraph("Signature", cell_hdr_style),
        ],
        [Paragraph("Brand Marketing Lead", cell_style), "", "[  ] Approved  [  ] Rejected", "", ""],
        [Paragraph("Packaging Engineer", cell_style), "", "[  ] Approved  [  ] Rejected", "", ""],
        [Paragraph("Regulatory Compliance", cell_style), "", "[  ] Approved  [  ] Rejected", "", ""],
    ]
    so_t = Table(so_data, colWidths=[120, 110, 130, 80, 100])
    so_t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(so_t)

    doc.build(story)
    logger.info(f"Generated PDF brief at {dest_path}")
    return str(dest_path)
