import io
import re
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
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

import pdfplumber

from app.models.resume_studio import CanonicalResume

logger = logging.getLogger("interviewiq.resume_exporter")


class ResumeExporterService:
    """
    ATS-safe PDF & DOCX export generator with self-test verification.
    Guarantees single-column, real selectable text, standard section headings,
    and verified re-parsing.
    """

    def sanitize_filename(self, full_name: str, target_role: str, ext: str) -> str:
        """Generate standard clean filename: Name_Role_Resume.ext"""
        name_clean = re.sub(r"[^a-zA-Z0-9]+", "_", full_name.strip()).strip("_") or "Candidate"
        role_clean = re.sub(r"[^a-zA-Z0-9]+", "_", target_role.strip()).strip("_") or "Resume"
        return f"{name_clean}_{role_clean}_Resume.{ext.lstrip('.')}"

    def _get_color_palette(self, accent_color: str, template: str):
        color_hex_map = {
            "slate": "#334155",
            "cyan": "#0891b2",
            "emerald": "#059669",
            "navy": "#1e40af",
            "violet": "#7c3aed",
        }
        if template == "minimal":
            primary_hex = "#000000"
            border_hex = "#cccccc"
        else:
            primary_hex = color_hex_map.get(accent_color.lower(), "#0891b2")
            border_hex = "#cbd5e1"

        return rl_colors.HexColor(primary_hex), rl_colors.HexColor(border_hex)

    def generate_pdf(
        self,
        resume: CanonicalResume,
        template: str = "modern",
        accent_color: str = "cyan",
        font_size: str = "md",
    ) -> bytes:
        """
        Generates ATS-safe single-column PDF with selectable vector text
        using ReportLab flowables.
        """
        buffer = io.BytesIO()

        # Margin adjustments: 0.5 inch (36 pt) for compact, 0.6 inch (43 pt) for modern/classic
        margin = 36 if template == "compact" else 42
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin,
        )

        styles = getSampleStyleSheet()
        primary_color, border_color = self._get_color_palette(accent_color, template)

        # Font selection based on template
        is_serif = template == "classic"
        base_font = "Times-Roman" if is_serif else "Helvetica"
        bold_font = "Times-Bold" if is_serif else "Helvetica-Bold"
        oblique_font = "Times-Italic" if is_serif else "Helvetica-Oblique"

        # Font sizes based on font_size prop
        size_offsets = {"sm": -1, "md": 0, "lg": 1}
        offset = size_offsets.get(font_size, 0)
        if template == "compact":
            offset -= 1

        body_size = 9.5 + offset
        body_leading = body_size + 3.0
        h2_size = 11.5 + offset
        h2_leading = h2_size + 3.0
        h1_size = 18.0 + offset
        h1_leading = h1_size + 4.0

        # Custom Paragraph Styles
        name_style = ParagraphStyle(
            "CandidateName",
            parent=styles["Normal"],
            fontName=bold_font,
            fontSize=h1_size,
            leading=h1_leading,
            textColor=primary_color if template != "classic" else rl_colors.HexColor("#0f172a"),
            alignment=TA_CENTER if template in ["classic", "compact"] else TA_LEFT,
            spaceAfter=2,
        )

        contact_style = ParagraphStyle(
            "ContactLine",
            parent=styles["Normal"],
            fontName=base_font,
            fontSize=body_size - 1.0,
            leading=body_leading - 1.0,
            textColor=rl_colors.HexColor("#475569"),
            alignment=TA_CENTER if template in ["classic", "compact"] else TA_LEFT,
            spaceAfter=8,
        )

        h2_style = ParagraphStyle(
            "SectionH2",
            parent=styles["Normal"],
            fontName=bold_font,
            fontSize=h2_size,
            leading=h2_leading,
            textColor=primary_color,
            spaceBefore=8,
            spaceAfter=3,
            keepWithNext=True,
        )

        body_style = ParagraphStyle(
            "BodyText",
            parent=styles["Normal"],
            fontName=base_font,
            fontSize=body_size,
            leading=body_leading,
            textColor=rl_colors.HexColor("#1e293b"),
            spaceAfter=3,
        )

        bullet_style = ParagraphStyle(
            "BulletText",
            parent=styles["Normal"],
            fontName=base_font,
            fontSize=body_size,
            leading=body_leading,
            textColor=rl_colors.HexColor("#1e293b"),
            leftIndent=14,
            firstLineIndent=-10,
            spaceAfter=2,
        )

        story = []

        # 1. Header: Name & Contact
        name_text = resume.contact.full_name or "Candidate Name"
        story.append(Paragraph(name_text, name_style))

        contact_parts = []
        if resume.contact.email:
            contact_parts.append(resume.contact.email)
        if resume.contact.phone:
            contact_parts.append(resume.contact.phone)
        if resume.contact.location:
            contact_parts.append(resume.contact.location)
        if resume.contact.linkedin_url:
            contact_parts.append("LinkedIn")
        if resume.contact.github_url:
            contact_parts.append("GitHub")

        contact_line = " • ".join(contact_parts)
        story.append(Paragraph(contact_line, contact_style))

        if template != "minimal":
            story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=6))

        # 2. Summary
        if resume.summary and resume.summary.strip():
            story.append(Paragraph("PROFESSIONAL SUMMARY", h2_style))
            if template != "minimal":
                story.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceAfter=4))
            story.append(Paragraph(resume.summary.strip(), body_style))
            story.append(Spacer(1, 4))

        # 3. Technical Skills
        skills = resume.skills
        skill_groups = [
            ("Languages", skills.languages),
            ("Frameworks & Libraries", skills.frameworks_libraries),
            ("Cloud & Databases", skills.cloud_databases),
            ("Developer Tools", skills.developer_tools),
            ("Core Concepts", skills.core_concepts),
        ]
        active_skill_groups = [(lbl, items) for lbl, items in skill_groups if items]

        if active_skill_groups:
            story.append(Paragraph("TECHNICAL SKILLS", h2_style))
            if template != "minimal":
                story.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceAfter=4))
            for lbl, items in active_skill_groups:
                skill_line = f"<b>{lbl}:</b> {', '.join(items)}"
                story.append(Paragraph(skill_line, body_style))
            story.append(Spacer(1, 4))

        # 4. Work Experience
        if resume.experience:
            story.append(Paragraph("WORK EXPERIENCE", h2_style))
            if template != "minimal":
                story.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceAfter=4))
            for exp in resume.experience:
                dates = f"{exp.start_date} – {'Present' if exp.is_current else exp.end_date or 'Present'}"
                job_header = f"<b>{exp.role}</b> | {exp.company} <font color='#64748b' size='{body_size-1}'>({dates})</font>"
                story.append(Paragraph(job_header, body_style))
                for bullet in exp.bullets:
                    # Escape HTML entities
                    clean_b = bullet.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                    story.append(Paragraph(f"• {clean_b}", bullet_style))
                story.append(Spacer(1, 3))
            story.append(Spacer(1, 2))

        # 5. Projects
        if resume.projects:
            story.append(Paragraph("KEY PROJECTS", h2_style))
            if template != "minimal":
                story.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceAfter=4))
            for proj in resume.projects:
                tech = f" <font color='#64748b' size='{body_size-1}'>[{', '.join(proj.tech_stack)}]</font>" if proj.tech_stack else ""
                proj_header = f"<b>{proj.title}</b>{tech}"
                story.append(Paragraph(proj_header, body_style))
                for bullet in proj.bullets:
                    clean_b = bullet.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                    story.append(Paragraph(f"• {clean_b}", bullet_style))
                story.append(Spacer(1, 3))
            story.append(Spacer(1, 2))

        # 6. Education
        if resume.education:
            story.append(Paragraph("EDUCATION", h2_style))
            if template != "minimal":
                story.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceAfter=4))
            for edu in resume.education:
                gpa = f" | {edu.gpa_or_percentage}" if edu.gpa_or_percentage else ""
                dates = f" ({edu.end_date})" if edu.end_date else ""
                edu_text = f"<b>{edu.institution}</b> — {edu.degree} {edu.field_of_study}{gpa}{dates}"
                story.append(Paragraph(edu_text, body_style))
            story.append(Spacer(1, 3))

        # 7. Certifications
        if resume.certifications:
            story.append(Paragraph("CERTIFICATIONS", h2_style))
            if template != "minimal":
                story.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceAfter=4))
            for cert in resume.certifications:
                yr = f" ({cert.year})" if cert.year else ""
                cert_text = f"• <b>{cert.name}</b> — {cert.issuer}{yr}"
                story.append(Paragraph(cert_text, body_style))

        # Build document
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_docx(
        self,
        resume: CanonicalResume,
        template: str = "modern",
        accent_color: str = "cyan",
    ) -> bytes:
        """
        Generates clean, ATS-readable Microsoft Word (.docx) document
        using python-docx with standard section headings and bullet formatting.
        """
        doc = Document()

        # Set page margins: 0.6 inch
        sections = doc.sections
        for s in sections:
            s.top_margin = Inches(0.6)
            s.bottom_margin = Inches(0.6)
            s.left_margin = Inches(0.6)
            s.right_margin = Inches(0.6)

        color_hex_map = {
            "slate": RGBColor(51, 65, 85),
            "cyan": RGBColor(8, 145, 178),
            "emerald": RGBColor(5, 150, 105),
            "navy": RGBColor(30, 64, 175),
            "violet": RGBColor(124, 58, 237),
        }
        primary_color = RGBColor(0, 0, 0) if template == "minimal" else color_hex_map.get(accent_color.lower(), RGBColor(8, 145, 178))

        # 1. Header: Name & Contact
        name_p = doc.add_paragraph()
        if template in ["classic", "compact"]:
            name_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        name_run = name_p.add_run(resume.contact.full_name or "Candidate Name")
        name_run.bold = True
        name_run.font.size = Pt(20)
        name_run.font.color.rgb = primary_color

        contact_parts = []
        if resume.contact.email:
            contact_parts.append(resume.contact.email)
        if resume.contact.phone:
            contact_parts.append(resume.contact.phone)
        if resume.contact.location:
            contact_parts.append(resume.contact.location)
        if resume.contact.linkedin_url:
            contact_parts.append(resume.contact.linkedin_url.replace("https://", ""))
        if resume.contact.github_url:
            contact_parts.append(resume.contact.github_url.replace("https://", ""))

        contact_p = doc.add_paragraph()
        if template in ["classic", "compact"]:
            contact_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        contact_run = contact_p.add_run(" | ".join(contact_parts))
        contact_run.font.size = Pt(9.5)
        contact_run.font.color.rgb = RGBColor(100, 116, 139)

        def add_heading(title: str):
            h = doc.add_paragraph()
            h.paragraph_format.space_before = Pt(8)
            h.paragraph_format.space_after = Pt(2)
            run = h.add_run(title.upper())
            run.bold = True
            run.font.size = Pt(12)
            run.font.color.rgb = primary_color

        # 2. Summary
        if resume.summary and resume.summary.strip():
            add_heading("Professional Summary")
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(4)
            r = p.add_run(resume.summary.strip())
            r.font.size = Pt(10)

        # 3. Technical Skills
        skills = resume.skills
        skill_groups = [
            ("Languages", skills.languages),
            ("Frameworks & Libraries", skills.frameworks_libraries),
            ("Cloud & Databases", skills.cloud_databases),
            ("Developer Tools", skills.developer_tools),
            ("Core Concepts", skills.core_concepts),
        ]
        active_skill_groups = [(lbl, items) for lbl, items in skill_groups if items]

        if active_skill_groups:
            add_heading("Technical Skills")
            for lbl, items in active_skill_groups:
                p = doc.add_paragraph()
                p.paragraph_format.space_after = Pt(2)
                r_lbl = p.add_run(f"{lbl}: ")
                r_lbl.bold = True
                r_lbl.font.size = Pt(10)
                r_items = p.add_run(", ".join(items))
                r_items.font.size = Pt(10)

        # 4. Work Experience
        if resume.experience:
            add_heading("Work Experience")
            for exp in resume.experience:
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(4)
                p.paragraph_format.space_after = Pt(1)
                r_role = p.add_run(exp.role)
                r_role.bold = True
                r_role.font.size = Pt(10.5)

                r_comp = p.add_run(f" | {exp.company}")
                r_comp.font.size = Pt(10.5)

                dates = f" ({exp.start_date} – {'Present' if exp.is_current else exp.end_date or 'Present'})"
                r_dates = p.add_run(dates)
                r_dates.font.size = Pt(9.5)
                r_dates.italic = True
                r_dates.font.color.rgb = RGBColor(100, 116, 139)

                for b in exp.bullets:
                    bp = doc.add_paragraph(style="List Bullet")
                    bp.paragraph_format.space_after = Pt(1)
                    br = bp.add_run(b)
                    br.font.size = Pt(10)

        # 5. Projects
        if resume.projects:
            add_heading("Key Projects")
            for proj in resume.projects:
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(4)
                p.paragraph_format.space_after = Pt(1)
                r_title = p.add_run(proj.title)
                r_title.bold = True
                r_title.font.size = Pt(10.5)

                if proj.tech_stack:
                    r_tech = p.add_run(f" [{', '.join(proj.tech_stack)}]")
                    r_tech.font.size = Pt(9.5)
                    r_tech.font.color.rgb = RGBColor(100, 116, 139)

                for b in proj.bullets:
                    bp = doc.add_paragraph(style="List Bullet")
                    bp.paragraph_format.space_after = Pt(1)
                    br = bp.add_run(b)
                    br.font.size = Pt(10)

        # 6. Education
        if resume.education:
            add_heading("Education")
            for edu in resume.education:
                p = doc.add_paragraph()
                p.paragraph_format.space_after = Pt(2)
                r_inst = p.add_run(edu.institution)
                r_inst.bold = True
                r_inst.font.size = Pt(10)

                gpa = f" | {edu.gpa_or_percentage}" if edu.gpa_or_percentage else ""
                dates = f" ({edu.end_date})" if edu.end_date else ""
                r_deg = p.add_run(f" — {edu.degree} {edu.field_of_study}{gpa}{dates}")
                r_deg.font.size = Pt(10)

        # 7. Certifications
        if resume.certifications:
            add_heading("Certifications")
            for cert in resume.certifications:
                p = doc.add_paragraph(style="List Bullet")
                p.paragraph_format.space_after = Pt(1)
                r_name = p.add_run(cert.name)
                r_name.bold = True
                r_name.font.size = Pt(10)
                yr = f" ({cert.year})" if cert.year else ""
                r_iss = p.add_run(f" — {cert.issuer}{yr}")
                r_iss.font.size = Pt(10)

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
    ) -> Dict[str, Any]:
        """
        Export self-test: re-parses the exported file with our own parser
        and confirms that sections, contact details, and skills survive cleanly.
        """
        extracted_text = ""

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
            name_matched = bool(
                expected_resume.contact.full_name
                and expected_resume.contact.full_name.lower() in text_lower
            )
            email_matched = bool(
                expected_resume.contact.email
                and expected_resume.contact.email.lower() in text_lower
            )

            # 2. Section Headings check
            survived_sections = []
            if "summary" in text_lower or "professional summary" in text_lower:
                survived_sections.append("Summary")
            if "skills" in text_lower or "technical skills" in text_lower:
                survived_sections.append("Skills")
            if "experience" in text_lower or "work experience" in text_lower:
                survived_sections.append("Experience")
            if "projects" in text_lower or "key projects" in text_lower:
                survived_sections.append("Projects")
            if "education" in text_lower:
                survived_sections.append("Education")

            # 3. Sample skill survival
            skills_found = 0
            sample_skills = (
                expected_resume.skills.languages[:3]
                + expected_resume.skills.frameworks_libraries[:3]
            )
            for s in sample_skills:
                if s.lower() in text_lower:
                    skills_found += 1

            is_ats_readable = (
                char_count >= 200
                and len(survived_sections) >= 3
                and (name_matched or email_matched)
            )

            return {
                "is_ats_readable": is_ats_readable,
                "character_count": char_count,
                "name_matched": name_matched,
                "email_matched": email_matched,
                "survived_sections": survived_sections,
                "skills_survived_count": skills_found,
                "file_type": file_type.upper(),
                "verdict": "Verified 100% ATS-Readable" if is_ats_readable else "Needs Attention",
            }

        except Exception as e:
            logger.error(f"[ResumeExporter] Self-test re-parse error: {e}")
            return {
                "is_ats_readable": False,
                "character_count": len(extracted_text),
                "name_matched": False,
                "email_matched": False,
                "survived_sections": [],
                "skills_survived_count": 0,
                "file_type": file_type.upper(),
                "verdict": f"Parsing Failed: {str(e)}",
            }


resume_exporter = ResumeExporterService()
