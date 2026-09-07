package de.zoll.wartungsfenster.entity;

import de.zoll.wartungsfenster.util.ColorMapConverter;
import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "servergruppe")
public class Servergruppe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "instanz_id", nullable = false)
    private Instanz instanz;

    @ManyToOne(optional = false)
    @JoinColumn(name = "umgebung_code", nullable = false)
    private Umgebung umgebung;

    @ManyToOne
    @JoinColumn(name = "domaene_id")
    private Domaene domaene;

    @Column(name = "jbossadmin")
    private String jbossAdmin = "";

    @Column(name = "jira_kennzeichen")
    private String jiraKennzeichen = "";

    @Column(name = "ansprechpartner")
    private String ansprechpartner = "";

    @Column(name = "aufrufadresse")
    private String aufrufadresse = "";

    @Column(name = "soa_endpunkte")
    private String soaEndpunkte = "";

    @Convert(converter = ColorMapConverter.class)
    @Column(name = "farben", columnDefinition = "json")
    private Map<String, String> farben = new LinkedHashMap<>();

    @OneToMany(mappedBy = "servergruppe", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ServergruppeArtefaktVorlage> artefaktVorlagen = new ArrayList<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Instanz getInstanz() { return instanz; }
    public void setInstanz(Instanz instanz) { this.instanz = instanz; }

    public Umgebung getUmgebung() { return umgebung; }
    public void setUmgebung(Umgebung umgebung) { this.umgebung = umgebung; }

    public Domaene getDomaene() { return domaene; }
    public void setDomaene(Domaene domaene) { this.domaene = domaene; }

    public String getJbossAdmin() { return jbossAdmin; }
    public void setJbossAdmin(String jbossAdmin) { this.jbossAdmin = jbossAdmin; }

    public String getJiraKennzeichen() { return jiraKennzeichen; }
    public void setJiraKennzeichen(String jiraKennzeichen) { this.jiraKennzeichen = jiraKennzeichen; }

    public String getAnsprechpartner() { return ansprechpartner; }
    public void setAnsprechpartner(String ansprechpartner) { this.ansprechpartner = ansprechpartner; }

    public String getAufrufadresse() { return aufrufadresse; }
    public void setAufrufadresse(String aufrufadresse) { this.aufrufadresse = aufrufadresse; }

    public String getSoaEndpunkte() { return soaEndpunkte; }
    public void setSoaEndpunkte(String soaEndpunkte) { this.soaEndpunkte = soaEndpunkte; }

    public Map<String, String> getFarben() { return farben; }
    public void setFarben(Map<String, String> farben) { this.farben = farben; }

    public List<ServergruppeArtefaktVorlage> getArtefaktVorlagen() { return artefaktVorlagen; }
    public void setArtefaktVorlagen(List<ServergruppeArtefaktVorlage> artefaktVorlagen) { this.artefaktVorlagen = artefaktVorlagen; }
}
