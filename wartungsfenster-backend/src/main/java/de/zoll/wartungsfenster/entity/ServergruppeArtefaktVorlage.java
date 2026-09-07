package de.zoll.wartungsfenster.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "servergruppe_artefakt_vorlage")
public class ServergruppeArtefaktVorlage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "servergruppe_id", nullable = false)
    private Servergruppe servergruppe;

    private String vorlage;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Servergruppe getServergruppe() { return servergruppe; }
    public void setServergruppe(Servergruppe servergruppe) { this.servergruppe = servergruppe; }

    public String getVorlage() { return vorlage; }
    public void setVorlage(String vorlage) { this.vorlage = vorlage; }
}
