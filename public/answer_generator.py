"""
正解CDS配列抽出スクリプト (BioPythonのみで動作)
"""
import sys
import traceback
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from Bio import SeqIO
from Bio.Seq import Seq


def parse_attributes(attr_text: str) -> Dict[str, str]:
    """GFF3 の属性欄を辞書化する簡易パーサー"""
    attrs: Dict[str, str] = {}
    for part in attr_text.split(";"):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        attrs[key] = value
    return attrs


def load_gene_list(path: Path) -> List[str]:
    with path.open() as f:
        return [line.strip() for line in f if line.strip()]


def load_fasta_sequences(path: Path) -> Dict[str, str]:
    records = {record.id: str(record.seq) for record in SeqIO.parse(path, "fasta")}
    if not records:
        raise ValueError(f"No sequences found in FASTA: {path}")
    return records


def collect_cds_regions(
    gff_path: Path, targets: Iterable[str]
) -> Dict[str, List[Tuple[str, int, int, str]]]:
    """
    GFF から対象遺伝子の CDS 座標を集める
    戻り値: {gene_name: [(seq_id, start, end, strand), ...]}
    """
    target_set = set(targets)
    cds_map: Dict[str, List[Tuple[str, int, int, str]]] = defaultdict(list)

    with gff_path.open() as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue

            cols = line.split("\t")
            if len(cols) < 9:
                continue

            seq_id, _source, feature, start, end, _score, strand, _phase, attr_text = cols
            if feature != "CDS":
                continue

            attrs = parse_attributes(attr_text)
            gene_name = attrs.get("Name") or attrs.get("gene") or attrs.get("ID")
            parent = attrs.get("Parent")

            target_gene = None
            if gene_name in target_set:
                target_gene = gene_name
            elif parent in target_set:
                target_gene = parent

            if not target_gene:
                continue

            cds_map[target_gene].append((seq_id, int(start), int(end), strand))

    return cds_map


def build_cds_sequence(
    fragments: List[Tuple[str, int, int, str]],
    fasta_sequences: Dict[str, str],
) -> str:
    if not fragments:
        return ""

    # start位置でソートし、マイナス鎖は連結順序を逆にする
    strand = fragments[0][3]
    sorted_frags = sorted(fragments, key=lambda item: item[1])
    if strand == "-":
        sorted_frags = list(reversed(sorted_frags))

    seq_parts: List[str] = []
    for seq_id, start, end, frag_strand in sorted_frags:
        if frag_strand != strand:
            raise ValueError("Mixed strand fragments detected")

        genome_seq = fasta_sequences.get(seq_id)
        if genome_seq is None:
            raise ValueError(f"Sequence '{seq_id}' not found in FASTA")

        fragment = genome_seq[start - 1 : end]
        if strand == "-":
            fragment = str(Seq(fragment).reverse_complement())

        seq_parts.append(fragment)

    return "".join(seq_parts)


def to_amino(sequence: str) -> str:
    """CDS塩基配列をアミノ酸配列に翻訳（終止コドンは * ）"""
    seq = sequence.upper()
    trimmed = seq[: len(seq) - (len(seq) % 3)]
    return str(Seq(trimmed).translate(to_stop=False))


def extract_cds_sequences(gff_path: str, fasta_path: str, gene_list_path: str, output_path: str):
    """
    GFFファイルとFASTAファイルから指定された遺伝子のCDS配列を抽出する
    """
    try:
        gff = Path(gff_path)
        fasta = Path(fasta_path)
        gene_list = Path(gene_list_path)
        output = Path(output_path)

        targets = load_gene_list(gene_list)
        print(f"Target genes ({len(targets)}): {targets}")

        fasta_sequences = load_fasta_sequences(fasta)
        print(f"✓ Loaded FASTA ({len(fasta_sequences)} sequences)")

        cds_map = collect_cds_regions(gff, targets)
        print(f"✓ Parsed GFF, found CDS for {len(cds_map)} targets")

        mode = str(globals().get("OUTPUT_MODE", "dna")).lower()
        if mode not in {"dna", "amino"}:
            mode = "dna"
        print(f"Output mode: {mode}")

        extracted_count = 0
        with output.open("w") as out:
            for gene in targets:
                fragments = cds_map.get(gene, [])
                if not fragments:
                    print(f"✗ No CDS found for {gene}")
                    continue

                cds_sequence = build_cds_sequence(fragments, fasta_sequences)
                seq_to_write = cds_sequence if mode == "dna" else to_amino(cds_sequence)
                out.write(f">{gene}\n{seq_to_write}\n")
                extracted_count += 1

        print(f"\n✓ Output written to: {output}")
        print(f"✓ Completed: {extracted_count} genes extracted")

    except Exception as e:
        print(f"\n✗ Error in extract_cds_sequences: {e}")
        traceback.print_exc()
        raise


# メイン実行
if __name__ == "__main__":
    try:
        print("=" * 60)
        print("Starting CDS extraction")
        print("=" * 60)
        extract_cds_sequences(
            gff_path="input.gff",
            fasta_path="input.fa",
            gene_list_path="genes.txt",
            output_path="answer.fasta",
        )
        print("=" * 60)
        print("✓ All done!")
        print("=" * 60)
    except Exception as e:
        print("=" * 60)
        print(f"✗ FATAL ERROR: {e}")
        print("=" * 60)
        traceback.print_exc()
        sys.exit(1)
