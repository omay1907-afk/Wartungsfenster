package de.zoll.wartungsfenster.entity;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(name = "wartungsfenster")
public class Wartungsfenster {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nummer;

    private LocalDate datum;

    // wird von MySQL per GENERATED ALWAYS AS (WEEKOFYEAR(datum)) berechnet - nur lesen, nicht schreiben
    @Column(insertable = false, updatable = false)
    private Integer kw;

    @Column(name = "atlas_release")
    private String atlasRelease;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNummer() { return nummer; }
    public void setNummer(String nummer) { this.nummer = nummer; }

    public LocalDate getDatum() { return datum; }
    public void setDatum(LocalDate datum) { this.datum = datum; }

    public Integer getKw() { return kw; }

    public String getAtlasRelease() { return atlasRelease; }
    public void setAtlasRelease(String atlasRelease) { this.atlasRelease = atlasRelease; }
}
