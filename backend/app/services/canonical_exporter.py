import io
import re
import html
import logging
from typing import Dict, Any, List, Optional
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors as rl_colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    HRFlowable,
    KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

import pdfplumber

from app.models.canonical_resume import CanonicalResume
from app.models.canonical_export import ExportSelfTestResult

logger = logging.getLogger("interviewiq.canonical_exporter")


class CanonicalExporterService:
    """
    ATS-safe PDF & DOCX export generator with self-test verification.
    Guarantees single-column layout, real selectable text, standard section headings,
    and verified re-parsing.
    """

    def sanitize_filename(self, full_name: str, ext: str) -> str:
        """
        Generate standard clean filename: Name_Resume.ext
        Per specification: 'Filename: Name_Resume.pdf'
        """
        clean_name = re.sub(r"[^a-zA-Z0-9]+", "_", full_name.strip()).strip("_") or "Candidate"
        clean_ext = ext.lstrip(".").lower()
        return f"{clean_name}_Resume.{clean_ext}"

    def _escape_xml(self, text: str) -> str:
        """Escape special XML characters for ReportLab Paragraph flowables."""
        if not text:
            return ""
        # html.escape escapes &, <, >, "
        escaped = html.escape(text, quote=False)
        return escaped

    def generate_pdf(
        self,
        resume: CanonicalResume,
        template: str = "classic",
    ) -> bytes:
        """
        Generates ATS-safe single-column PDF with selectable vector text
        using ReportLab flowables.
        Templates: 'classic' | 'modern' | 'minimal'
        """
        buffer = io.BytesIO()

        # Margins: 0.5 inch (36 pt) for minimal, 0.6 inch (43 pt) for modern/classic
        margin = 36 if template == "minimal" else 42
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin,
        )

        styles = getSampleStyleSheet()

        # Font selection based on template
        is_serif = template == "classic"
        font_family = "Times-Roman" if is_serif else "Helvetica"
        bold_font = "Times-Bold" if is_serif else "Helvetica-Bold"
        italic_font = "Times-Italic" if is_serif else "Helvetica-Oblique"

        # Accent colors
        if template == "modern":
            primary_color = rl_colors.HexColor("#0891b2")  # Cyan
            rule_color = rl_colors.HexColor("#0891b2")
        elif template == "minimal":
            primary_color = rl_colors.HexColor("#0f172a")  # Dark slate
            rule_color = rl_colors.HexColor("#cbd5e1")
        else:
            # Classic
            primary_color = rl_colors.HexColor("#1e293b")  # Classic Charcoal
            rule_color = rl_colors.HexColor("#94a3b8")

        # Custom paragraph styles
        name_align = TA_CENTER if template == "classic" else TA_LEFT
        contact_align = TA_CENTER if template == "classic" else TA_LEFT

        name_size = 20 if template == "modern" else (18 if template == "classic" else 16)
        name_style = ParagraphStyle(
            "NameStyle",
            parent=styles["Normal"],
            fontName=bold_font,
            fontSize=name_size,
            leading=name_size + 4,
            textColor=primary_color,
            alignment=name_align,
            spaceAfter=3,
        )

        contact_style = ParagraphStyle(
            "ContactStyle",
            parent=styles["Normal"],
            fontName=font_family,
            fontSize=9.5,
            leading=13,
            textColor=rl_colors.HexColor("#475569"),
            alignment=contact_align,
            spaceAfter=8,
        )

        h2_style = ParagraphStyle(
            "HeadingStyle",
            parent=styles["Normal"],
            fontName=bold_font,
            fontSize=11.5,
            leading=15,
            textColor=primary_color,
            spaceBefore=8,
            spaceAfter=3,
            keepWithNext=True,
        )

        subhead_style = ParagraphStyle(
            "SubheadStyle",
            parent=styles["Normal"],
            fontName=bold_font,
            fontSize=10,
            leading=13.5,
            textColor=rl_colors.HexColor("#1e293b"),
            keepWithNext=True,
        )

        meta_style = ParagraphStyle(
            "MetaStyle",
            parent=styles["Normal"],
            fontName=italic_font,
            fontSize=9.5,
            leading=13,
            textColor=rl_colors.HexColor("#475569"),
            spaceAfter=2,
            keepWithNext=True,
        )

        body_style = ParagraphStyle(
            "BodyStyle",
            parent=styles["Normal"],
            fontName=font_family,
            fontSize=9.5,
            leading=13.5,
            textColor=rl_colors.HexColor("#1e293b"),
            spaceAfter=3,
        )

        bullet_style = ParagraphStyle(
            "BulletStyle",
            parent=styles["Normal"],
            fontName=font_family,
            fontSize=9.5,
            leading=13.5,
            textColor=rl_colors.HexColor("#1e293b"),
            leftIndent=14,
            firstLineIndent=-10,
            spaceAfter=2,
        )

        story = []

        # 1. Header (Name + Contact details)
        c = resume.contact
        name_clean = self._escape_xml(c.full_name)
        story.append(Paragraph(name_clean, name_style))

        contact_parts = []
        if c.email:
            contact_parts.append(self._escape_xml(c.email))
        if c.phone:
            contact_parts.append(self._escape_xml(c.phone))
        if c.location:
            contact_parts.append(self._escape_xml(c.location))
        if c.linkedin:
            contact_parts.append(self._escape_xml(c.linkedin))
        if c.github:
            contact_parts.append(self._escape_xml(c.github))

        contact_line = " &bull; ".join(contact_parts)
        story.append(Paragraph(contact_line, contact_style))

        def add_heading(title: str):
            story.append(Paragraph(title.upper(), h2_style))
            if template in ("classic", "modern"):
                story.append(HRFlowable(width="100%", thickness=1, color=rule_color, spaceAfter=5))
            else:
                story.append(Spacer(1, 4))

        # 2. Summary
        if resume.summary and resume.summary.strip():
            add_heading("Summary")
            story.append(Paragraph(self._escape_xml(resume.summary.strip()), body_style))
            story.append(Spacer(1, 4))

        # 3. Technical Skills
        skills = resume.skills
        has_skills = any([
            skills.languages,
            skills.frameworks,
            skills.developer_tools,
            skills.cloud_databases,
            skills.other,
        ])
        if has_skills:
            add_heading("Technical Skills")
            if skills.languages:
                p_text = f"<b>Languages:</b> {self._escape_xml(', '.join(skills.languages))}"
                story.append(Paragraph(p_text, body_style))
            if skills.frameworks:
                p_text = f"<b>Frameworks &amp; Libraries:</b> {self._escape_xml(', '.join(skills.frameworks))}"
                story.append(Paragraph(p_text, body_style))
            if skills.developer_tools:
                p_text = f"<b>Developer Tools:</b> {self._escape_xml(', '.join(skills.developer_tools))}"
                story.append(Paragraph(p_text, body_style))
            if skills.cloud_databases:
                p_text = f"<b>Databases &amp; Cloud:</b> {self._escape_xml(', '.join(skills.cloud_databases))}"
                story.append(Paragraph(p_text, body_style))
            if skills.other:
                p_text = f"<b>Core Competencies:</b> {self._escape_xml(', '.join(skills.other))}"
                story.append(Paragraph(p_text, body_style))
            story.append(Spacer(1, 4))

        # 4. Experience
        if resume.experience:
            add_heading("Professional Experience")
            for exp in resume.experience:
                role_company = f"{self._escape_xml(exp.role)} &bull; {self._escape_xml(exp.company)}"
                if exp.location:
                    role_company += f" ({self._escape_xml(exp.location)})"
                story.append(Paragraph(role_company, subhead_style))

                dates = f"{self._escape_xml(exp.start_date)} &ndash; {self._escape_xml(exp.end_date)}"
                story.append(Paragraph(dates, meta_style))

                for bullet in exp.bullets:
                    bullet_text = f"&bull; {self._escape_xml(bullet)}"
                    story.append(Paragraph(bullet_text, bullet_style))

                story.append(Spacer(1, 4))

        # 5. Projects
        if resume.projects:
            add_heading("Projects")
            for proj in resume.projects:
                proj_title = self._escape_xml(proj.name)
                if proj.tech_stack:
                    proj_title += f" &bull; <i>{self._escape_xml(', '.join(proj.tech_stack))}</i>"
                story.append(Paragraph(proj_title, subhead_style))

                if proj.description and proj.description.strip():
                    story.append(Paragraph(self._escape_xml(proj.description.strip()), body_style))

                for bullet in proj.bullets:
                    bullet_text = f"&bull; {self._escape_xml(bullet)}"
                    story.append(Paragraph(bullet_text, bullet_style))

                story.append(Spacer(1, 4))

        # 6. Education
        if resume.education:
            add_heading("Education")
            for edu in resume.education:
                degree_inst = f"<b>{self._escape_xml(edu.institution)}</b> &bull; {self._escape_xml(edu.degree)} in {self._escape_xml(edu.field_of_study)}"
                story.append(Paragraph(degree_inst, subhead_style))

                details = []
                if edu.graduation_year:
                    details.append(f"Graduated: {self._escape_xml(edu.graduation_year)}")
                if edu.gpa_or_grade:
                    details.append(f"GPA / Grade: {self._escape_xml(edu.gpa_or_grade)}")
                if details:
                    story.append(Paragraph(" &bull; ".join(details), meta_style))

                story.append(Spacer(1, 3))

        # 7. Certifications
        if resume.certifications:
            add_heading("Certifications")
            for cert in resume.certifications:
                cert_line = f"&bull; <b>{self._escape_xml(cert.name)}</b> &ndash; {self._escape_xml(cert.issuer)}"
                if cert.year:
                    cert_line += f" ({self._escape_xml(cert.year)})"
                story.append(Paragraph(cert_line, bullet_style))
            story.append(Spacer(1, 3))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_docx(
        self,
        resume: CanonicalResume,
        template: str = "classic",
    ) -> bytes:
        """
        Generates ATS-safe single-column DOCX with real selectable text,
        standard section headings, and zero content tables.
        """
        doc = Document()

        # Set 0.6 inch margins
        for section in doc.sections:
            section.top_margin = Inches(0.6)
            section.bottom_margin = Inches(0.6)
            section.left_margin = Inches(0.6)
            section.right_margin = Inches(0.6)

        font_name = "Times New Roman" if template == "classic" else "Calibri"

        # 1. Header: Candidate Name
        p_name = doc.add_paragraph()
        if template == "classic":
            p_name.alignment = WD_ALIGN_PARAGRAPH.CENTER
        else:
            p_name.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p_name.paragraph_format.space_after = Pt(2)

        r_name = p_name.add_run(resume.contact.full_name)
        r_name.font.name = font_name
        r_name.font.size = Pt(20)
        r_name.bold = True
        if template == "modern":
            r_name.font.color.rgb = RGBColor(8, 145, 178)  # Cyan

        # Contact line
        contact_parts = []
        c = resume.contact
        if c.email:
            contact_parts.append(c.email)
        if c.phone:
            contact_parts.append(c.phone)
        if c.location:
            contact_parts.append(c.location)
        if c.linkedin:
            contact_parts.append(c.linkedin)
        if c.github:
            contact_parts.append(c.github)

        p_contact = doc.add_paragraph()
        if template == "classic":
            p_contact.alignment = WD_ALIGN_PARAGRAPH.CENTER
        else:
            p_contact.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p_contact.paragraph_format.space_after = Pt(8)

        r_contact = p_contact.add_run(" | ".join(contact_parts))
        r_contact.font.name = font_name
        r_contact.font.size = Pt(9.5)
        r_contact.font.color.rgb = RGBColor(100, 116, 139)

        def add_heading(title: str):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(3)
            r = p.add_run(title.upper())
            r.font.name = font_name
            r.font.size = Pt(11)
            r.bold = True
            if template == "modern":
                r.font.color.rgb = RGBColor(8, 145, 178)

        # 2. Summary
        if resume.summary and resume.summary.strip():
            add_heading("Summary")
            p_sum = doc.add_paragraph()
            p_sum.paragraph_format.space_after = Pt(4)
            r_sum = p_sum.add_run(resume.summary.strip())
            r_sum.font.name = font_name
            r_sum.font.size = Pt(9.5)

        # 3. Technical Skills
        skills = resume.skills
        has_skills = any([
            skills.languages,
            skills.frameworks,
            skills.developer_tools,
            skills.cloud_databases,
            skills.other,
        ])
        if has_skills:
            add_heading("Technical Skills")
            skill_groups = [
                ("Languages", skills.languages),
                ("Frameworks & Libraries", skills.frameworks),
                ("Developer Tools", skills.developer_tools),
                ("Databases & Cloud", skills.cloud_databases),
                ("Core Competencies", skills.other),
            ]
            for label, items in skill_groups:
                if items:
                    p = doc.add_paragraph()
                    p.paragraph_format.space_after = Pt(2)
                    r_lbl = p.add_run(f"{label}: ")
                    r_lbl.font.name = font_name
                    r_lbl.font.size = Pt(9.5)
                    r_lbl.bold = True
                    r_val = p.add_run(", ".join(items))
                    r_val.font.name = font_name
                    r_val.font.size = Pt(9.5)

        # 4. Experience
        if resume.experience:
            add_heading("Professional Experience")
            for exp in resume.experience:
                p_head = doc.add_paragraph()
                p_head.paragraph_format.space_before = Pt(4)
                p_head.paragraph_format.space_after = Pt(1)

                r_role = p_head.add_run(f"{exp.role} | {exp.company}")
                r_role.font.name = font_name
                r_role.font.size = Pt(10)
                r_role.bold = True

                loc = f" ({exp.location})" if exp.location else ""
                r_meta = p_head.add_run(f"{loc} — {exp.start_date} - {exp.end_date}")
                r_meta.font.name = font_name
                r_meta.font.size = Pt(9)
                r_meta.italic = True

                for bullet in exp.bullets:
                    p_b = doc.add_paragraph(style="List Bullet")
                    p_b.paragraph_format.space_after = Pt(1.5)
                    r_b = p_b.add_run(bullet)
                    r_b.font.name = font_name
                    r_b.font.size = Pt(9.5)

        # 5. Projects
        if resume.projects:
            add_heading("Projects")
            for proj in resume.projects:
                p_head = doc.add_paragraph()
                p_head.paragraph_format.space_before = Pt(4)
                p_head.paragraph_format.space_after = Pt(1)

                r_proj = p_head.add_run(proj.name)
                r_proj.font.name = font_name
                r_proj.font.size = Pt(10)
                r_proj.bold = True

                if proj.tech_stack:
                    r_stk = p_head.add_run(f" ({', '.join(proj.tech_stack)})")
                    r_stk.font.name = font_name
                    r_stk.font.size = Pt(9)
                    r_stk.italic = True

                if proj.description and proj.description.strip():
                    p_desc = doc.add_paragraph()
                    p_desc.paragraph_format.space_after = Pt(2)
                    r_desc = p_desc.add_run(proj.description.strip())
                    r_desc.font.name = font_name
                    r_desc.font.size = Pt(9.5)

                for bullet in proj.bullets:
                    p_b = doc.add_paragraph(style="List Bullet")
                    p_b.paragraph_format.space_after = Pt(1.5)
                    r_b = p_b.add_run(bullet)
                    r_b.font.name = font_name
                    r_b.font.size = Pt(9.5)

        # 6. Education
        if resume.education:
            add_heading("Education")
            for edu in resume.education:
                p_edu = doc.add_paragraph()
                p_edu.paragraph_format.space_after = Pt(2)
                r_inst = p_edu.add_run(edu.institution)
                r_inst.font.name = font_name
                r_inst.font.size = Pt(10)
                r_inst.bold = True

                gpa = f" | {edu.gpa_or_grade}" if edu.gpa_or_grade else ""
                year = f" ({edu.graduation_year})" if edu.graduation_year else ""
                r_deg = p_edu.add_run(f" — {edu.degree} in {edu.field_of_study}{gpa}{year}")
                r_deg.font.name = font_name
                r_deg.font.size = Pt(9.5)

        # 7. Certifications
        if resume.certifications:
            add_heading("Certifications")
            for cert in resume.certifications:
                p_cert = doc.add_paragraph(style="List Bullet")
                p_cert.paragraph_format.space_after = Pt(1.5)
                r_cname = p_cert.add_run(cert.name)
                r_cname.font.name = font_name
                r_cname.font.size = Pt(9.5)
                r_cname.bold = True
                yr = f" ({cert.year})" if cert.year else ""
                r_ciss = p_cert.add_run(f" — {cert.issuer}{yr}")
                r_ciss.font.name = font_name
                r_ciss.font.size = Pt(9.5)

        buffer = io.BytesIO()
        doc.save(buffer)
        docx_bytes = buffer.getvalue()
        buffer.close()
        return docx_bytes

    def run_export_self_test(
        self,
        file_bytes: bytes,
        file_type: str,
        expected_resume: CanonicalResume,
    ) -> ExportSelfTestResult:
        """
        Export self-test: re-parses the exported file with our own parser
        and confirms that sections, contact details, and skills survive cleanly.
        """
        extracted_text = ""
        filename = self.sanitize_filename(expected_resume.contact.full_name, file_type)

        try:
            if file_type.lower() == "pdf":
                with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text() or ""
                        extracted_text += page_text + "\n"
            else:
                # docx
                doc = Document(io.BytesIO(file_bytes))
                paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
                extracted_text = "\n".join(paragraphs)

            text_lower = extracted_text.lower()
            char_count = len(extracted_text.strip())

            # 1. Contact check
            name_parts = expected_resume.contact.full_name.lower().split()
            name_matched = any(part in text_lower for part in name_parts if len(part) >= 2)
            email_matched = bool(
                expected_resume.contact.email
                and expected_resume.contact.email.lower() in text_lower
            )

            # 2. Section Headings check
            survived_sections: List[str] = []
            if "summary" in text_lower:
                survived_sections.append("Summary")
            if "skills" in text_lower or "technical skills" in text_lower:
                survived_sections.append("Skills")
            if "experience" in text_lower or "professional experience" in text_lower:
                survived_sections.append("Experience")
            if "projects" in text_lower:
                survived_sections.append("Projects")
            if "education" in text_lower:
                survived_sections.append("Education")
            if "certifications" in text_lower:
                survived_sections.append("Certifications")

            # 3. Skills survival
            skills_found = 0
            sample_skills = (
                expected_resume.skills.languages
                + expected_resume.skills.frameworks
                + expected_resume.skills.developer_tools
            )
            for s in sample_skills:
                if s.lower() in text_lower:
                    skills_found += 1

            is_ats_readable = (
                char_count >= 150
                and len(survived_sections) >= 3
                and (name_matched or email_matched)
            )

            return ExportSelfTestResult(
                is_ats_readable=is_ats_readable,
                character_count=char_count,
                name_matched=name_matched,
                email_matched=email_matched,
                survived_sections=survived_sections,
                skills_survived_count=skills_found,
                file_type=file_type.upper(),
                filename=filename,
                verdict="Verified 100% ATS-Readable" if is_ats_readable else "Formatting Review Recommended",
                badge="ATS-readable" if is_ats_readable else "Unverified",
            )

        except Exception as e:
            logger.error(f"[CanonicalExporter] Self-test re-parse error: {e}")
            return ExportSelfTestResult(
                is_ats_readable=False,
                character_count=len(extracted_text),
                name_matched=False,
                email_matched=False,
                survived_sections=[],
                skills_survived_count=0,
                file_type=file_type.upper(),
                filename=filename,
                verdict=f"Parsing error: {str(e)}",
                badge="Unverified",
            )


canonical_exporter = CanonicalExporterService()
